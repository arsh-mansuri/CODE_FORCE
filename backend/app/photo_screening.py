"""Local face detection for property galleries, not identity recognition.

OpenCV ships the pretrained frontal/profile Haar models with its wheel, so upload
checks do not need an API key, a remote service, or a runtime model download.
No detected face is not proof that an image depicts a property.
"""
from functools import lru_cache
from pathlib import Path
from threading import Lock

import cv2
import numpy as np
from PIL import Image

from .security import problem


_detector_lock = Lock()


@lru_cache(maxsize=1)
def face_detectors():
    detectors = tuple(cv2.CascadeClassifier(str(Path(cv2.data.haarcascades) / name)) for name in (
        "haarcascade_frontalface_default.xml", "haarcascade_profileface.xml",
    ))
    if any(detector.empty() for detector in detectors):
        raise RuntimeError("Face detection models are unavailable")
    return detectors


def contains_face(image: Image.Image) -> bool:
    # Bound CPU/memory independently of the size of the original upload.
    preview = image.convert("L")
    preview.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    gray = cv2.equalizeHist(np.asarray(preview))
    # Cached classifiers are shared between FastAPI worker threads.
    with _detector_lock:
        frontal, profile = face_detectors()
        for turn in range(4):
            oriented = np.ascontiguousarray(np.rot90(gray, turn))
            for detector, frame in ((frontal, oriented), (profile, oriented), (profile, cv2.flip(oriented, 1))):
                if len(detector.detectMultiScale(frame, scaleFactor=1.1, minNeighbors=6, minSize=(30, 30))):
                    return True
    return False


def validate_property_photo(image: Image.Image) -> None:
    try:
        has_face = contains_face(image)
    except (cv2.error, RuntimeError) as exc:
        raise problem(503, "photo_screening_unavailable", "We couldn't check this property photo. Please retry shortly.") from exc
    if has_face:
        raise problem(422, "property_photo_contains_face",
            "A face was detected in a property photo. Use photos of the rooms, kitchen, building or shared spaces without people. Add portraits to your profile gallery instead. No photos in this batch were saved.")
