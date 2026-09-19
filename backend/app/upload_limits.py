"""Bound total multipart bytes, including chunked requests, before spooling huge uploads."""
from fastapi.responses import JSONResponse

from .security import problem


class UploadLimitMiddleware:
    def __init__(self, app, maximum_bytes: int):
        self.app = app
        self.maximum_bytes = maximum_bytes

    async def __call__(self, scope, receive, send):
        is_upload = scope.get("path", "").startswith("/api/media/") or (
            scope.get("path", "").startswith("/api/listings/") and scope.get("path", "").endswith("/reviews"))
        if scope["type"] != "http" or scope["method"] != "POST" or not is_upload:
            return await self.app(scope, receive, send)
        headers = dict(scope["headers"])
        try:
            length = int(headers.get(b"content-length", b"0"))
        except ValueError:
            length = 0  # The streaming check remains authoritative.
        detail = {"code": "upload_too_large", "message": f"Keep the complete upload under {self.maximum_bytes // (1024 * 1024)} MiB.", "fields": []}
        if length > self.maximum_bytes:
            response = JSONResponse(status_code=413, content={"error": detail})
            return await response(scope, receive, send)
        total = 0

        async def limited_receive():
            nonlocal total
            message = await receive()
            if message["type"] == "http.request":
                total += len(message.get("body", b""))
                if total > self.maximum_bytes:
                    raise problem(413, "upload_too_large", detail["message"])
            return message

        await self.app(scope, limited_receive, send)
