#!/usr/bin/env python3
"""Czysta geometria planu postaci — bez Blendera, łatwa do testowania.

Wejście: `measurements.json` z `tools/character-scan`.
Wyjście: słownik wymiarów w metrach oraz pierścienie torsu.

Moduł nie twierdzi, że odtwarza ukrytą anatomię. Głębokości są jawnymi
założeniami antropometrycznymi, a nie pomiarem z jednego zdjęcia.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import json
import math
from pathlib import Path


@dataclass
class Landmark:
    name: str
    y_ratio: float
    width_m: float
    z: float


@dataclass
class Plan:
    height: float
    head_top: float
    head_max_z: float
    head_width: float
    head_depth: float
    head_height: float
    head_bottom: float
    head_center_z: float
    shoulder_z: float
    shoulder_width: float
    arm_span: float
    arm_half: float
    waist_z: float
    waist_width: float
    hip_z: float
    hip_width: float
    crotch_z: float
    lower_leg_z: float
    lower_leg_width: float
    ground_width: float
    leg_center_x: float
    face_width: float = 0.0
    eye_z: float = 0.0
    eye_x: float = 0.0
    eye_width: float = 0.0
    eye_height: float = 0.0
    iris_width: float = 0.0
    iris_height: float = 0.0
    nose_z: float = 0.0
    mouth_z: float = 0.0
    chin_z: float = 0.0
    hair_width: float = 0.0
    hair_half: float = 0.0
    torso_rings: list[dict] = field(default_factory=list)
    landmarks: dict[str, Landmark] = field(default_factory=dict)

    def as_dict(self) -> dict:
        result = {
            key: value
            for key, value in self.__dict__.items()
            if key not in ("torso_rings", "landmarks")
        }
        result["torso_rings"] = self.torso_rings
        result["landmarks"] = {
            key: value.__dict__ for key, value in self.landmarks.items()
        }
        return result


def load_measurements(path: Path) -> dict:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if "landmarks" not in data or "scale" not in data:
        raise ValueError("to nie jest plik measurements.json z character-scan")
    return data


def _landmarks(data: dict, height: float) -> dict[str, Landmark]:
    result = {}
    for item in data["landmarks"]:
        name = item["name"]
        result[name] = Landmark(
            name=name,
            y_ratio=float(item["y_ratio"]),
            width_m=float(item["width_mm"]) / 1000.0,
            z=height * (1.0 - float(item["y_ratio"])),
        )
    return result


def _get(landmarks: dict[str, Landmark], name: str, fallback: Landmark) -> Landmark:
    return landmarks.get(name, fallback)


def build_plan(data: dict, height: float | None = None) -> Plan:
    """Zbuduj plan w metrach. Domyślna wysokość pochodzi z measurements.json."""
    height = float(height if height is not None else data["scale"]["height_mm"] / 1000.0)
    if height <= 0:
        raise ValueError("wysokość musi być dodatnia")

    landmarks = _landmarks(data, height)
    fallback = Landmark("fallback", 0.0, height * 0.3, height)
    head = _get(landmarks, "head_max", fallback)
    arm = _get(landmarks, "arm_span", fallback)
    waist = _get(landmarks, "waist", fallback)
    hip = _get(landmarks, "hip", fallback)
    crotch = _get(landmarks, "crotch", fallback)
    lower = _get(landmarks, "lower_leg_min", fallback)
    ground = _get(landmarks, "ground", fallback)

    face = data.get("face")
    has_face = isinstance(face, dict) and bool(face.get("face_width_px"))

    if has_face:
        face_width = max(0.12, float(face["face_width_mm"]) / 1000.0)
        eye_z = height * (1.0 - float(face["eye_line_y_ratio"]))
        chin_z = height * (1.0 - float(face["chin_y_ratio"]))
        # Oko leży około 56% wysokości głowy od czubka; reszta to twarz i broda.
        head_height = max(
            face_width * 0.85,
            (eye_z - chin_z) / 0.44,
        )
        head_top = chin_z + head_height
        head_bottom = chin_z
        head_center_z = (head_top + head_bottom) / 2.0
        head_width = face_width * 1.06
        head_depth = head_width * 1.0
        eye_x = max(0.02, float(face["eye_spacing_mm"]) / 2000.0)
        iris_width = max(0.02, float(face["iris_width_mm"]) / 1000.0)
        iris_height = max(0.025, float(face["iris_height_mm"]) / 1000.0)
        eye_width = iris_width * 1.55
        eye_height = iris_height * 1.45
        nose_z = eye_z - 0.055
        mouth_z = chin_z + 0.028
    else:
        # Wsteczny wariant dla sylwetki bez rozpoznanej twarzy: szerokość
        # głowy pochodzi z obrysu włosów, więc jest jawnie zgrubna.
        head_width = max(0.2, head.width_m)
        head_height = max(height * 0.26, min(height * 0.36, head_width * 0.85))
        head_top = height
        head_bottom = max(0.0, head_top - head_height)
        head_center_z = (head_top + head_bottom) / 2.0
        head_depth = max(0.18, head_width * 0.88)
        face_width = head_width
        eye_z = head_center_z - head_height * 0.04
        chin_z = head_bottom
        eye_x = head_width * 0.22
        iris_width = head_width * 0.11
        iris_height = head_width * 0.14
        eye_width = head_width * 0.18
        eye_height = head_width * 0.22
        nose_z = eye_z - 0.05
        mouth_z = chin_z + 0.03

    if has_face:
        shoulder_z = min(arm.z, head_bottom - 0.05)
        hip_body_width = hip.width_m * 0.72
        waist_body_width = waist.width_m * 0.96
        shoulder_width = max(waist_body_width * 1.08, head_width * 1.25)
        shoulder_width = min(shoulder_width, arm.width_m * 0.48)
    else:
        shoulder_z = min(
            head_bottom - height * 0.02,
            max(arm.z, height * 0.45),
        )
        hip_body_width = hip.width_m
        waist_body_width = waist.width_m
        shoulder_width = max(
            waist_body_width * 0.9,
            min(hip_body_width * 0.92, arm.width_m * 0.42),
        )
    shoulder_z = max(height * 0.35, shoulder_z)
    arm_span = max(shoulder_width * 1.8, arm.width_m)
    arm_half = arm_span / 2.0

    waist_width = max(0.18, waist_body_width)
    hip_width = max(waist_width * 0.9, hip_body_width)
    leg_center_x = max(0.06, hip_width * 0.22)
    hair_width = max(head.width_m, head_width * 1.5)
    hair_half = hair_width / 2.0

    torso_rings = [
        {
            "name": "crotch",
            "z": max(0.05, crotch.z),
            "width": max(0.28, hip_width * 0.86),
            "depth": max(0.16, hip_width * 0.50),
        },
        {
            "name": "hip",
            "z": max(0.1, hip.z),
            "width": hip_width,
            "depth": max(0.18, hip_width * 0.58),
        },
        {
            "name": "waist",
            "z": max(0.15, waist.z),
            "width": waist_width,
            "depth": max(0.14, waist_width * 0.55),
        },
        {
            "name": "chest",
            "z": max(0.2, shoulder_z - 0.05),
            "width": max(waist_width * 1.08, shoulder_width * 1.02),
            "depth": max(0.18, shoulder_width * 0.55),
        },
        {
            "name": "shoulder",
            "z": max(0.25, shoulder_z),
            "width": shoulder_width,
            "depth": max(0.16, shoulder_width * 0.53),
        },
    ]
    torso_rings.sort(key=lambda ring: ring["z"])

    return Plan(
        height=height,
        head_top=head_top,
        head_max_z=head.z,
        head_width=head_width,
        head_depth=head_depth,
        head_height=head_height,
        head_bottom=head_bottom,
        head_center_z=head_center_z,
        shoulder_z=shoulder_z,
        shoulder_width=shoulder_width,
        arm_span=arm_span,
        arm_half=arm_half,
        waist_z=waist.z,
        waist_width=waist_width,
        hip_z=hip.z,
        hip_width=hip_width,
        crotch_z=crotch.z,
        lower_leg_z=lower.z,
        lower_leg_width=lower.width_m,
        ground_width=ground.width_m,
        leg_center_x=leg_center_x,
        face_width=face_width,
        eye_z=eye_z,
        eye_x=eye_x,
        eye_width=eye_width,
        eye_height=eye_height,
        iris_width=iris_width,
        iris_height=iris_height,
        nose_z=nose_z,
        mouth_z=mouth_z,
        chin_z=chin_z,
        hair_width=hair_width,
        hair_half=hair_half,
        torso_rings=torso_rings,
        landmarks=landmarks,
    )


def ring_vertices(ring: dict, segments: int = 24) -> list[tuple[float, float, float]]:
    """Punkty elipsy w płaszczyźnie X/Y na wysokości Z."""
    rx = ring["width"] / 2.0
    ry = ring["depth"] / 2.0
    z = ring["z"]
    return [
        (rx * math.cos(2.0 * math.pi * index / segments),
         ry * math.sin(2.0 * math.pi * index / segments),
         z)
        for index in range(segments)
    ]


def loft_faces(ring_count: int, segments: int) -> list[tuple[int, ...]]:
    """Ściany boczne loftu i dwie pokrywy."""
    faces: list[tuple[int, ...]] = []
    for ring_index in range(ring_count - 1):
        start = ring_index * segments
        next_start = (ring_index + 1) * segments
        for index in range(segments):
            following = (index + 1) % segments
            faces.append(
                (
                    start + index,
                    start + following,
                    next_start + following,
                    next_start + index,
                )
            )
    faces.append(tuple(range(segments - 1, -1, -1)))
    last = (ring_count - 1) * segments
    faces.append(tuple(last + index for index in range(segments)))
    return faces
