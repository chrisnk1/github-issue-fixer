use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};
use std::path::PathBuf;

/// Persisted process information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedProcess {
    pub pid: i32,
    pub name: String,
    pub cmd: String,
    pub start_time: DateTime<Utc>,
    pub state: String, // "running", "suspended", "terminated"
}

/// Complete state snapshot for a sandbox
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateSnapshot {
    pub sandbox_id: String,
    pub timestamp: DateTime<Utc>,
    pub processes: Vec<PersistedProcess>,
}

impl StateSnapshot {
    /// Create a new state snapshot
    pub fn new(sandbox_id: String) -> Self {
        Self {
            sandbox_id,
            timestamp: Utc::now(),
            processes: Vec::new(),
        }
    }

    /// Add a process to the snapshot
    pub fn add_process(&mut self, process: PersistedProcess) {
        self.processes.push(process);
    }

    /// Get the snapshot file path
    pub fn get_snapshot_path(&self, base_dir: &PathBuf) -> PathBuf {
        base_dir.join(format!("{}.snapshot.json", self.sandbox_id))
    }

    /// Serialize to JSON string
    pub fn to_json(&self) -> Result<String, Box<dyn std::error::Error>> {
        Ok(serde_json::to_string_pretty(self)?)
    }

    /// Deserialize from JSON string
    pub fn from_json(json: &str) -> Result<Self, Box<dyn std::error::Error>> {
        Ok(serde_json::from_str(json)?)
    }

    /// Check if this snapshot is stale (older than 24 hours)
    pub fn is_stale(&self) -> bool {
        let max_age = chrono::Duration::hours(24);
        Utc::now() - self.timestamp > max_age
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn test_state_snapshot_serialization() {
        let mut snapshot = StateSnapshot::new("test-sandbox".to_string());
        
        let process = PersistedProcess {
            pid: 1234,
            name: "test-process".to_string(),
            cmd: "test-command".to_string(),
            start_time: Utc.with_ymd_and_hms(2023, 1, 1, 12, 0, 0).unwrap(),
            state: "running".to_string(),
        };
        
        snapshot.add_process(process);
        
        let json = snapshot.to_json().unwrap();
        let restored = StateSnapshot::from_json(&json).unwrap();
        
        assert_eq!(restored.sandbox_id, "test-sandbox");
        assert_eq!(restored.processes.len(), 1);
        assert_eq!(restored.processes[0].pid, 1234);
    }

    #[test]
    fn test_stale_snapshot_detection() {
        let mut snapshot = StateSnapshot::new("test-sandbox".to_string());
        // Set timestamp to 25 hours ago
        snapshot.timestamp = Utc::now() - chrono::Duration::hours(25);
        
        assert!(snapshot.is_stale());
    }
}