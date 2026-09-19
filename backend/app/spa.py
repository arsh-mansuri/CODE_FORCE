from pathlib import PurePosixPath

from starlette.exceptions import HTTPException
from starlette.staticfiles import StaticFiles


class SPAStaticFiles(StaticFiles):
    """Serve the React build, falling back only for client-side page routes."""

    async def get_response(self, path, scope):
        # Missing API endpoints must stay JSON 404s, never become the app shell.
        if path.split("/", 1)[0] in {"api", "docs", "redoc", "openapi.json"}:
            raise HTTPException(status_code=404)
        try:
            return await super().get_response(path, scope)
        except HTTPException as exc:
            # Missing assets and traversal attempts must not return index.html.
            parts = PurePosixPath(path).parts
            if (
                exc.status_code != 404
                or ".." in parts
                or PurePosixPath(path).suffix
                or path.split("/", 1)[0] == "assets"
            ):
                raise
            return await super().get_response("index.html", scope)
