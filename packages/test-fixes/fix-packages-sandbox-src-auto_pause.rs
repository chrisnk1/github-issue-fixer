use std::collections::HashMap;
use std::process::{Command, Stdio};
use std::time::Duration;
use tokio::time::timeout;
use nix::sys::signal::{self, Signal};
use nix::unistd::Pid;
use serde::{Serialize, Deserialize};
use log::{info, warn, error};

use crate::process::{ProcessInfo, ProcessManager};
use crate::state_snapshot::{StateSnapshot, PersistedProcess};
use crate::persistence::PersistenceManager;

/// Configuration for auto-pause behavior
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoPauseConfig {
    /// Whether to kill processes on auto-pause (default: true)
    pub kill_on_pause: bool,
    /// Timeout for graceful shutdown in seconds (default: 30)
    pub graceful_timeout_secs: u64,
}

impl Default for AutoPauseConfig {
    fn default() -> Self {
        Self {
            kill_on_pause: true,
            graceful_timeout_secs: 30,
        }
    }
}

/// Manages auto-pause functionality for sandboxes
pub struct AutoPauseManager {
    config: AutoPauseConfig,
    process_manager: ProcessManager,
    persistence_manager: PersistenceManager,
}

impl AutoPauseManager {
    pub fn new(config: AutoPauseConfig) -> Self {
        Self {
            config,
            process_manager: ProcessManager::new(),
            persistence_manager: PersistenceManager::new(),
        }
    }

    /// Prepare sandbox for auto-pause
    pub async fn prepare_pause(&self, sandbox_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        info!("Preparing sandbox {} for auto-pause", sandbox_id);
        
        if self.config.kill_on_pause {
            // Kill all user processes gracefully
            self.kill_all_processes(sandbox_id).await?;
        } else {
            // Persist current process state for resume
            self.persist_process_state(sandbox_id).await?;
        }
        
        Ok(())
    }

    /// Kill all user processes in the sandbox
    async fn kill_all_processes(&self, sandbox_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        let processes = self.process_manager.list_processes(sandbox_id).await?;
        
        // Send SIGTERM to all process groups first (graceful shutdown)
        for process in &processes {
            if let Ok(pid) = Pid::from_raw(process.pid) {
                // Kill the entire process group
                let pgid = -process.pid; // Negative PID kills process group
                if let Err(e) = signal::killpg(Pid::from_raw(pgid), Signal::SIGTERM) {
                    warn!("Failed to send SIGTERM to process group {}: {}", pgid, e);
                }
            }
        }

        // Wait for graceful shutdown
        let grace_period = Duration::from_secs(self.config.graceful_timeout_secs);
        match timeout(grace_period, self.wait_for_processes_to_exit(sandbox_id)).await {
            Ok(Ok(())) => {
                info!("All processes exited gracefully");
                return Ok(());
            }
            _ => {
                warn!("Graceful shutdown timed out, forcing kill");
            }
        }

        // Force kill any remaining processes
        let remaining_processes = self.process_manager.list_processes(sandbox_id).await?;
        for process in &remaining_processes {
            if let Ok(pid) = Pid::from_raw(process.pid) {
                let pgid = -process.pid;
                if let Err(e) = signal::killpg(Pid::from_raw(pgid), Signal::SIGKILL) {
                    error!("Failed to send SIGKILL to process group {}: {}", pgid, e);
                }
            }
        }

        Ok(())
    }

    /// Wait for all processes to exit
    async fn wait_for_processes_to_exit(&self, sandbox_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        let check_interval = Duration::from_millis(500);
        let max_checks = 60; // 30 seconds total
        
        for _ in 0..max_checks {
            let processes = self.process_manager.list_processes(sandbox_id).await?;
            if processes.is_empty() {
                return Ok(());
            }
            tokio::time::sleep(check_interval).await;
        }
        
        Err("Timeout waiting for processes to exit".into())
    }

    /// Persist current process state to disk
    async fn persist_process_state(&self, sandbox_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        let processes = self.process_manager.list_processes(sandbox_id).await?;
        
        let persisted_processes: Vec<PersistedProcess> = processes
            .into_iter()
            .map(|p| PersistedProcess {
                pid: p.pid,
                name: p.name,
                cmd: p.cmd,
                start_time: p.start_time,
                state: "running".to_string(),
            })
            .collect();

        let snapshot = StateSnapshot {
            sandbox_id: sandbox_id.to_string(),
            timestamp: chrono::Utc::now(),
            processes: persisted_processes,
        };

        self.persistence_manager.save_snapshot(&snapshot).await?;
        info!("Persisted {} processes for sandbox {}", snapshot.processes.len(), sandbox_id);
        
        Ok(())
    }

    /// Restore sandbox after auto-resume
    pub async fn after_resume(&self, sandbox_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        info!("Restoring sandbox {} after auto-resume", sandbox_id);
        
        if !self.config.kill_on_pause {
            // Load persisted process state
            self.restore_process_state(sandbox_id).await?;
        }
        
        Ok(())
    }

    /// Restore process state from persistence
    async fn restore_process_state(&self, sandbox_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(snapshot) = self.persistence_manager.load_snapshot(sandbox_id).await? {
            info!("Restoring {} processes for sandbox {}", snapshot.processes.len(), sandbox_id);
            
            // Update process manager with restored state
            self.process_manager.restore_processes(sandbox_id, snapshot.processes).await?;
        } else {
            warn!("No persisted state found for sandbox {}", sandbox_id);
        }
        
        Ok(())
    }
}