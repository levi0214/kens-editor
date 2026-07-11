use chrono::{Local, NaiveDateTime, TimeZone};
use std::collections::HashSet;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

const VAULT_DIR_NAME: &str = "KensEditor";
const PINS_FILE_NAME: &str = ".pins.json";
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

/// Creation time from vault filenames like `2026-07-09_151300.txt`
/// or `2026-07-09_151300_2.txt`. Falls back to None for nonstandard names.
fn created_ms_from_name(name: &str) -> Option<u64> {
    let stem = name.strip_suffix(".txt")?;
    let stamp = stem.get(..17)?;
    let naive = NaiveDateTime::parse_from_str(stamp, "%Y-%m-%d_%H%M%S").ok()?;
    let local = Local.from_local_datetime(&naive).single()?;
    u64::try_from(local.timestamp_millis()).ok()
}

fn created_ms(path: &Path, name: &str) -> Result<u64, String> {
    if let Some(ms) = created_ms_from_name(name) {
        return Ok(ms);
    }
    modified_ms(path)
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

fn pins_path(dir: &Path) -> PathBuf {
    dir.join(PINS_FILE_NAME)
}

fn read_pins(dir: &Path) -> Result<HashSet<String>, String> {
    let path = pins_path(dir);
    if !path.exists() {
        return Ok(HashSet::new());
    }

    let text = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    let names: Vec<String> = serde_json::from_str(&text).unwrap_or_default();
    Ok(names.into_iter().collect())
}

fn write_pins(dir: &Path, pins: &HashSet<String>) -> Result<(), String> {
    let path = pins_path(dir);
    if pins.is_empty() {
        if path.exists() {
            fs::remove_file(&path).map_err(|error| error.to_string())?;
        }
        return Ok(());
    }

    let mut names: Vec<&String> = pins.iter().collect();
    names.sort();
    let text = serde_json::to_string(&names).map_err(|error| error.to_string())?;
    write_atomic(&path, &text)
}

fn vault_file_name(path: &Path) -> Result<String, String> {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .filter(|name| name.ends_with(".txt"))
        .ok_or_else(|| "Not a vault document".to_string())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct VaultDocument {
    name: String,
    path: String,
    created_ms: u64,
    preview: String,
    pinned: bool,
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
    let pins = read_pins(dir)?;
    let mut documents = Vec::new();

    for entry in fs::read_dir(dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();

        if !is_vault_text_file(&path) {
            continue;
        }

        let name = path
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_default();
        let pinned = pins.contains(&name);

        documents.push(VaultDocument {
            created_ms: created_ms(&path, &name)?,
            name,
            path: path.to_string_lossy().into_owned(),
            preview: file_preview(&path)?,
            pinned,
        });
    }

    documents.sort_by(|left, right| {
        right
            .pinned
            .cmp(&left.pinned)
            .then(right.created_ms.cmp(&left.created_ms))
    });
    Ok(documents)
}

#[tauri::command]
fn most_recent_vault_document() -> Result<Option<String>, String> {
    Ok(list_vault_documents()?
        .into_iter()
        .max_by_key(|document| document.created_ms)
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
        .max_by_key(|document| document.created_ms)
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

    let name = vault_file_name(&path)?;
    let dir = ensure_vault_exists()?;

    if path.exists() {
        trash::delete(&path).map_err(|error| error.to_string())?;
    }

    let mut pins = read_pins(&dir)?;
    if pins.remove(&name) {
        write_pins(&dir, &pins)?;
    }

    Ok(())
}

#[tauri::command]
fn toggle_vault_document_pin(path: String) -> Result<bool, String> {
    let path = PathBuf::from(path);

    if !is_vault_path(&path)? || !is_vault_text_file(&path) {
        return Err("Not a vault document".to_string());
    }

    let name = vault_file_name(&path)?;
    let dir = ensure_vault_exists()?;
    let mut pins = read_pins(&dir)?;
    let pinned = if pins.remove(&name) {
        false
    } else {
        pins.insert(name);
        true
    };
    write_pins(&dir, &pins)?;
    Ok(pinned)
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
            toggle_vault_document_pin,
            reveal_vault_in_finder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
