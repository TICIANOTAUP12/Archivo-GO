import os
from pathlib import Path, PurePosixPath, PureWindowsPath

CONTAINER_INPUT_ROOT = Path("/host/input")
CONTAINER_STORAGE_ROOT = Path("/host/storage")
WRITABLE_STORAGE_FALLBACK = Path("/tmp/archivo-storage")


def get_container_storage_root() -> Path:
    for candidate in (CONTAINER_STORAGE_ROOT, WRITABLE_STORAGE_FALLBACK):
        try:
            candidate.mkdir(parents=True, exist_ok=True)
            probe = candidate / ".write_probe"
            probe.write_text("ok", encoding="utf-8")
            probe.unlink(missing_ok=True)
            return candidate
        except OSError:
            continue
    WRITABLE_STORAGE_FALLBACK.mkdir(parents=True, exist_ok=True)
    return WRITABLE_STORAGE_FALLBACK


def resolve_source_path(source_path: str) -> Path:
    direct_path = Path(source_path)
    if direct_path.exists():
        return direct_path

    mounted_path = _resolve_from_configured_mount(source_path)
    if mounted_path.exists():
        return mounted_path

    raise FileNotFoundError(source_path)


def to_host_storage_path(container_path: Path) -> str:
    storage_root = get_container_storage_root()
    return _to_host_path(container_path, storage_root, "HOST_STORAGE_ROOT")


def to_host_input_path(container_path: Path) -> str:
    return _to_host_path(container_path, CONTAINER_INPUT_ROOT, "HOST_INPUT_ROOT")


def relative_to_input_root(source_path: Path) -> Path:
    try:
        return source_path.relative_to(CONTAINER_INPUT_ROOT)
    except ValueError:
        return Path(source_path.name)


def _resolve_from_configured_mount(source_path: str) -> Path:
    host_root = os.getenv("HOST_INPUT_ROOT")
    if not host_root:
        raise FileNotFoundError(source_path)

    if _looks_like_windows_path(source_path) or _looks_like_windows_path(host_root):
        relative_parts = _relative_windows_parts(source_path, host_root)
    else:
        relative_parts = _relative_posix_parts(source_path, host_root)

    if relative_parts is None:
        raise FileNotFoundError(source_path)

    return CONTAINER_INPUT_ROOT.joinpath(*relative_parts)


def _to_host_path(container_path: Path, container_root: Path, env_name: str) -> str:
    host_root = os.getenv(env_name)
    if not host_root:
        return str(container_path)
    try:
        relative_parts = container_path.relative_to(container_root).parts
    except ValueError:
        return str(container_path)
    if _looks_like_windows_path(host_root):
        return str(PureWindowsPath(host_root).joinpath(*relative_parts))
    return str(PurePosixPath(host_root).joinpath(*relative_parts))


def _relative_windows_parts(source_path: str, host_root: str) -> tuple[str, ...] | None:
    source = PureWindowsPath(source_path)
    root = PureWindowsPath(host_root)
    source_parts = _casefold_parts(source.parts)
    root_parts = _casefold_parts(root.parts)

    if source_parts == root_parts:
        return ()
    if len(source_parts) < len(root_parts) or source_parts[: len(root_parts)] != root_parts:
        return None
    return source.parts[len(root.parts) :]


def _relative_posix_parts(source_path: str, host_root: str) -> tuple[str, ...] | None:
    source = PurePosixPath(source_path)
    root = PurePosixPath(host_root)
    if source == root:
        return ()
    try:
        return source.relative_to(root).parts
    except ValueError:
        return None


def _casefold_parts(parts: tuple[str, ...]) -> tuple[str, ...]:
    return tuple(part.casefold().rstrip("\\/") for part in parts)


def _looks_like_windows_path(value: str) -> bool:
    return "\\" in value or PureWindowsPath(value).drive != ""
