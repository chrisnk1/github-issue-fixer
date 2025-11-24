use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};
use log::{info, debug};

/// Information about a running process
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: i32,
    pub name: String,
    pub cmd: String,
    pub start_time: DateTime<Utc>,
    pub state: ProcessState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProcessState {
    Running,
    Suspended,
    Terminated,
}

/// Process manager for tracking sandbox processes
pub struct ProcessManager {
    processes: Arc<RwLock<HashMap<String, Vec<ProcessInfo>>>>, // sandbox_id -> processes
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// List all processes in a sandbox
    pub async fn list_processes(&self, sandbox_id: &str) -> Result<Vec<ProcessInfo>, Box<dyn std::error::Error>> {
        let processes = self.processes.read().await;
        Ok(processes.get(sandbox_id).cloned().unwrap_or_default())
    }

    /// Add a process to tracking
    pub async fn add_process(&self, sandbox_id: &str, process: ProcessInfo) -> Result<(), Box<dyn std::error::Error>> {
        let mut processes = self.processes.write().await;
        let sandbox_processes = processes.entry(sandbox_id.to_string()).or_default();
        
        // Check if process already exists
        if !sandbox_processes.iter().any(|p| p.pid == process.pid) {
            sandbox_processes.push(process);
            debug!("Added process {} to sandbox {}", process.pid, sandbox_id);
        }
        
        Ok(())
    }

    /// Remove a process from tracking
    pub async fn remove_process(&self, sandbox_id: &str, pid: i32) -> Result<(), Box<dyn std::error::Error>> {
        let mut processes = self.processes.write().await;
        if let Some(sandbox_processes) = processes.get_mut(sandbox_id) {
            sandbox_processes.retain(|p| p.pid != pid);
            debug!("Removed process {} from sandbox {}", pid, sandbox_id);
        }
        
        Ok(())
    }

    /// Update process state
    pub async fn update_process_state(&self, sandbox_id: &str, pid: i32, state: ProcessState) -> Result<(), Box<dyn std::error::Error>> {
        let mut processes = self.processes.write().await;
        if let Some(sandbox_processes) = processes.get_mut(sandbox_id) {
            if let Some(process) = sandbox_processes.iter_mut().find(|p| p.pid == pid) {
                process.state = state;
                debug!("Updated process {} state to {:?}", pid, state);
            }
        }
        
        Ok(())
    }

    /// Restore processes from persisted state
    pub async fn restore_processes(&self, sandbox_id: &str, persisted: Vec<crate::state_snapshot::PersistedProcess>) -> Result<(), Box<dyn std::error::Error>> {
        let mut processes = self.processes.write().await;
        let sandbox_processes = processes.entry(sandbox_id.to_string()).or_default();
        
        // Clear existing processes
        sandbox_processes.clear();
        
        // Restore from persisted state
        for persisted_proc in persisted {
            let process_info = ProcessInfo {
                pid: persisted_proc.pid,
                name: persisted_proc.name,
                cmd: persisted_proc.cmd,
                start_time: persisted_proc.start_time,
                state: match persisted_proc.state.as_str() {
                    "running" => ProcessState::Running,
                    "suspended" => ProcessState::Suspended,
                    _ => ProcessState::Terminated,
                },
            };
            sandbox_processes.push(process_info);
        }
        
        info!("Restored {} processes for sandbox {}", sandbox_processes.len(), sandbox_id);
        Ok(())
    }

    /// Clear all processes for a sandbox
    pub async fn clear_sandbox(&self, sandbox_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        let mut processes = self.processes.write().await;
        processes.remove(sandbox_id);
        info!("Cleared all processes for sandbox {}", sandbox_id);
        Ok(())
    }
}