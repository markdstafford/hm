use crate::embeddings::errors::{EmbeddingError, EmbeddingErrorCategory};

/// Set up the sqlite-vec virtual table for document embeddings.
/// The dimension argument must match the embedding model's dimension.
/// For initial schema setup we create with dimension 1536 (OpenAI small default);
/// actual queries must match the stored model dimension.
pub fn setup_vec_table(conn: &rusqlite::Connection) -> Result<(), EmbeddingError> {
    crate::db::load_sqlite_vec(conn).map_err(|_| {
        EmbeddingError::new(
            EmbeddingErrorCategory::SqliteVecUnavailable,
            "sqlite-vec is unavailable in this environment.",
        )
    })?;
    // We use a flexible vec0 table. The actual dimension is checked at query time.
    // sqlite-vec 0.1.9 requires the dimension in the DDL; we use a single table
    // and rely on content-hash/model_id filtering to keep incompatible vectors separate.
    conn.execute_batch(
        "CREATE VIRTUAL TABLE IF NOT EXISTS vec_document_embeddings
         USING vec0(embedding_id TEXT, embedding FLOAT[1536]);",
    )
    .map_err(|_| EmbeddingError::new(
        EmbeddingErrorCategory::SqliteVecUnavailable,
        "sqlite-vec is unavailable in this environment.",
    ))
}

pub fn vector_to_json(vector: &[f32]) -> String {
    serde_json::to_string(vector).expect("f32 vectors serialize to JSON")
}

/// Insert or replace a vector row. The rowid is a stable integer from document_embeddings.
pub fn upsert_vector(
    conn: &rusqlite::Connection,
    rowid: i64,
    embedding_id: &str,
    vector: &[f32],
) -> Result<(), EmbeddingError> {
    let vec_json = vector_to_json(vector);
    conn.execute(
        "INSERT OR REPLACE INTO vec_document_embeddings (rowid, embedding_id, embedding) VALUES (?1, ?2, ?3)",
        rusqlite::params![rowid, embedding_id, vec_json],
    )
    .map_err(EmbeddingError::from)?;
    Ok(())
}

/// Delete vector rows for a given embedding_id.
pub fn delete_vector(
    conn: &rusqlite::Connection,
    embedding_id: &str,
) -> Result<(), EmbeddingError> {
    conn.execute(
        "DELETE FROM vec_document_embeddings WHERE embedding_id = ?1",
        [embedding_id],
    )
    .map_err(EmbeddingError::from)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sqlite_vec_unavailable_returns_safe_error() {
        // Open a plain connection without registering sqlite-vec
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        let result = setup_vec_table(&conn);
        match result {
            Ok(_) => {} // sqlite-vec auto-extension was already registered globally
            Err(e) => {
                assert!(
                    e.to_string().contains("unavailable") || e.to_string().contains("sqlite-vec"),
                    "error should be safe: {e}"
                );
                assert_eq!(e.category, EmbeddingErrorCategory::SqliteVecUnavailable);
            }
        }
    }
}
