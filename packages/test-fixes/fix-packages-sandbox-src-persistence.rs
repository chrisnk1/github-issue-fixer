use std::path::{Path, PathBuf};
use std::fs;
use tokio::fs as async_fs;
use log::{info, warn, error};
use chrono::{DateTime, Utc};

use crate::state_snapshot::StateSnapshot;

/// Manages persistence of sandbox state
pub struct PersistenceManager {
    base_dir: PathBuf,
}

impl PersistenceManager {
    pub fn new() -> Self {
        Self {
            base_dir: PathBuf::from("/var/lib/e2b/snapshots"),
        }
    }

    pub fn with_base_dir(base_dir: PathBuf) -> Self {
        Self { base_dir }
    }

    /// Save a state snapshot to disk
    pub async fn save_snapshot(&self, snapshot: &StateSnapshot) -> Result<(), Box<dyn std::error::Error>> {
        // Ensure directory exists
        async_fs::create_dir_all(&self.base_dir).await?;
        
        let file_path = snapshot.get_snapshot_path(&self.base_dir);
        let json = snapshot.to_json()?;
        
        // Write atomically by writing to temp file then renaming
        let temp_path = file_path.with_extension("tmp");
        async_fs::write(&temp_path, json).await?;
        
        // Atomic rename
        async_fs::rename(&temp_path, &file_path).await?;
        
        info!("Saved state snapshot for sandbox {} to {}", snapshot.sandbox_id, file_path.display());
        Ok(())
    }

    /// Load a state snapshot from disk
    pub async fn load_snapshot(&self, sandbox_id: &str) -> Result<Option<StateSnapshot>, Box<dyn std::error::Error>> {
        let file_path = self.base_dir.join(format!("{}.snapshot.json", sandbox_id));
        
        if !file_path.exists() {
            return Ok(None);
        }
        
        let json = async_fs::read_to_string(&file_path).await?;
        let snapshot = StateSnapshot::from_json(&json)?;
        
        // Check if snapshot is stale
        if snapshot.is_stale() {
            warn!("Found stale snapshot for sandbox {}, removing", sandbox_id);
            self.remove_snapshot(sandbox_id).await?;
            return Ok(None);
        }
        
        info!("Loaded state snapshot for sandbox {} from {}", sandbox_id, file_path.display());
        Ok(Some(snapshot))
    }

    /// Remove a state snapshot
    pub async fn remove_snapshot(&self, sandbox_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        let file_path = self.base_dir.join(format!("{}.snapshot.json", sandbox_id));
        
        if file_path.exists() {
            async_fs::remove_file(&file_path).await?;
            info!("Removed state snapshot for sandbox {}", sandbox_id);
        }
        
        Ok(())
    }

    /// Clean up old snapshots (older than 24 hours)
    pub async fn cleanup_old_snapshots(&self) -> Result<(), Box<dyn std::error::Error>> {
        let mut entries = async_fs::read_dir(&self.base_dir).await?;
        
        while let Some(entry) = entries.next().await {
            let entry = entry?;
            let path = entry.path();
            
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(json) = async_fs::read_to_string(&path).await {
                    if let Ok(snapshot) = StateSnapshot::from_json(&json) {
                        if snapshot.is_stale() {
                            if let Err(e) = async_fs::remove_file(&path).await {
                                error!("Failed to remove stale snapshot {}: {}", path.display(), e);
                            } else {
                                info!("Removed stale snapshot for sandbox {}", snapshot.sandbox_id);
                            }
                        }
                    }
                }
            }
        }
        
        Ok(())
    }

    /// Get the base directory for snapshots
    pub fn get_base_dir(&self) -> &Path {
        &self.base_dir
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use chrono::TimeZone;

    #[tokio::test]
    async fn test_snapshot_persistence() {
        let temp_dir = TempDir::new().unwrap();
        let manager = PersistenceManager::with_base_dir(temp_dir.path().to_path_buf());
        
        let mut snapshot = StateSnapshot::new("test-sandbox".to_string());
        let process = crate::state_snapshot::PersistedProcess {
            pid: 1234,
            name: "test-process".to_string(),
            cmd: "test-command".to_string(),
            start_time: Utc.with_ymd_and_hms(2023, 1, 1, 12, 0, 0).unwrap(),
            state: "running".to_string(),
        };
        snapshot.add_process(process);
        
        // Save snapshot
        manager.save_snapshot(&snapshot).await.unwrap();
        
        // Load snapshot
        let loaded = manager.load_snapshot("test-sandbox").await.unwrap().unwrap();
        assert_eq!(loaded.sandbox_id, "test-sandbox");
        assert_eq!(loaded.processes.len(), 1);
        
        // Remove snapshot
        manager.remove_snapshot("test-sandbox").await.unwrap();
        assert!(manager.load_snapshot("test-sandbox").await.unwrap().is_none());
    }
}