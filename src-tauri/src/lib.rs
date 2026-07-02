use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

const VAULT_DIR_NAME: &str = "KensEditor";
const PREVIEW_MAX_CHARS: usize = 80;
const PREVIEW_READ_BYTES: usize = 256;

fn vault_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or_else(|| "Could not find home directory".to_string())?;
    Ok(home.join("Documents").join(VAULT_DIR_NAME))
}

fn ensure_vault_exists() -> Result<PathBuf, String> {
    let dir = vault_dir()?;
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir)
}

fn write_atomic(path: &Path, contents: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let temp_path = path.with_extension("tmp");
    fs::write(&temp_path, contents.as_bytes()).map_err(|error| error.to_string())?;
    fs::rename(&temp_path, path).map_err(|error| error.to_string())?;
    Ok(())
}

fn is_vault_text_file(path: &Path) -> bool {
    path.is_file() && path.extension().is_some_and(|extension| extension == "txt")
}

fn is_vault_path(path: &Path) -> Result<bool, String> {
    let vault = ensure_vault_exists()?;
    let canonical_vault = fs::canonicalize(&vault).map_err(|error| error.to_string())?;
    let canonical_path = fs::canonicalize(path).map_err(|error| error.to_string())?;
    Ok(canonical_path.starts_with(canonical_vault))
}

fn timestamp_ms(time: Result<std::time::SystemTime, std::io::Error>) -> Result<u64, String> {
    let time = time.map_err(|error| error.to_string())?;

    time.duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .map_err(|error| error.to_string())
}

fn modified_ms(path: &Path) -> Result<u64, String> {
    let metadata = fs::metadata(path).map_err(|error| error.to_string())?;
    timestamp_ms(metadata.modified())
}

fn created_ms(path: &Path) -> Result<u64, String> {
    let metadata = fs::metadata(path).map_err(|error| error.to_string())?;
    timestamp_ms(metadata.created().or_else(|_| metadata.modified()))
}

fn collapse_whitespace(text: &str) -> String {
    let mut result = String::new();
    let mut last_was_space = false;

    for ch in text.chars() {
        if ch.is_whitespace() {
            if !result.is_empty() && !last_was_space {
                result.push(' ');
                last_was_space = true;
            }
        } else {
            result.push(ch);
            last_was_space = false;
        }
    }

    result.trim_end().to_string()
}

fn preview_from_text(text: &str) -> String {
    let collapsed = collapse_whitespace(text);

    if collapsed.is_empty() {
        return "(empty)".to_string();
    }

    let char_count = collapsed.chars().count();
    if char_count <= PREVIEW_MAX_CHARS {
        return collapsed;
    }

    let truncated: String = collapsed.chars().take(PREVIEW_MAX_CHARS).collect();
    format!("{truncated}…")
}

fn file_preview(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path).map_err(|error| error.to_string())?;
    let mut buffer = vec![0u8; PREVIEW_READ_BYTES];
    let read = file.read(&mut buffer).map_err(|error| error.to_string())?;
    buffer.truncate(read);

    Ok(preview_from_text(&String::from_utf8_lossy(&buffer)))
}

fn unique_vault_path(dir: &Path) -> PathBuf {
    let stamp = chrono::Local::now().format("%Y-%m-%d_%H%M%S");
    let base = format!("{stamp}.txt");
    let mut path = dir.join(&base);

    if !path.exists() {
        return path;
    }

    for index in 2.. {
        path = dir.join(format!("{stamp}_{index}.txt"));
        if !path.exists() {
            return path;
        }
    }

    dir.join(format!("{stamp}_overflow.txt"))
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct VaultDocument {
    name: String,
    path: String,
    created_ms: u64,
    modified_ms: u64,
    preview: String,
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    write_atomic(Path::new(&path), &contents)
}

#[tauri::command]
fn list_vault_documents() -> Result<Vec<VaultDocument>, String> {
    let dir = ensure_vault_exists()?;
    read_vault_documents(&dir)
}

fn read_vault_documents(dir: &Path) -> Result<Vec<VaultDocument>, String> {
    let mut documents = Vec::new();

    for entry in fs::read_dir(dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();

        if !is_vault_text_file(&path) {
            continue;
        }

        documents.push(VaultDocument {
            name: path
                .file_name()
                .map(|name| name.to_string_lossy().into_owned())
                .unwrap_or_default(),
            path: path.to_string_lossy().into_owned(),
            created_ms: created_ms(&path)?,
            modified_ms: modified_ms(&path)?,
            preview: file_preview(&path)?,
        });
    }

    documents.sort_by(|left, right| right.modified_ms.cmp(&left.modified_ms));
    Ok(documents)
}

#[tauri::command]
fn most_recent_vault_document() -> Result<Option<String>, String> {
    Ok(list_vault_documents()?
        .into_iter()
        .max_by_key(|document| document.modified_ms)
        .map(|document| document.path))
}

#[tauri::command]
fn peek_most_recent_vault_document() -> Result<Option<String>, String> {
    let dir = vault_dir()?;
    if !dir.is_dir() {
        return Ok(None);
    }

    Ok(read_vault_documents(&dir)?
        .into_iter()
        .max_by_key(|document| document.modified_ms)
        .map(|document| document.path))
}

#[tauri::command]
fn create_vault_document() -> Result<String, String> {
    let dir = ensure_vault_exists()?;
    let path = unique_vault_path(&dir);
    write_atomic(&path, "")?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
fn delete_vault_document(path: String) -> Result<(), String> {
    let path = PathBuf::from(path);

    if !is_vault_path(&path)? {
        return Err("Not a vault document".to_string());
    }

    if path.exists() {
        fs::remove_file(&path).map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn reveal_vault_in_finder() -> Result<(), String> {
    let dir = ensure_vault_exists()?;

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&dir)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = dir;
        return Err("Reveal in Finder is only supported on macOS".to_string());
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri::Manager;

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            if let Some(window) = app.get_webview_window("main") {
                use tauri::TitleBarStyle;
                let _ = window.set_title_bar_style(TitleBarStyle::Overlay);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            list_vault_documents,
            most_recent_vault_document,
            peek_most_recent_vault_document,
            create_vault_document,
            delete_vault_document,
            reveal_vault_in_finder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
