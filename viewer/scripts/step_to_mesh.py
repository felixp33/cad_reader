"""Convert a STEP file to a viewer-friendly mesh: <out>/model.json (assembly tree + part meshes) and
<out>/model.bin (float32 positions / normals, uint32 indices). Parts are meshed once and instanced.

Usage: step_to_mesh.py <input.stp> <out_dir> [linear_deflection_mm]
"""
import json
import sys
from pathlib import Path

import numpy as np
from OCP.BRep import BRep_Tool
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.IFSelect import IFSelect_RetDone
from OCP.Quantity import Quantity_Color
from OCP.STEPCAFControl import STEPCAFControl_Reader
from OCP.TCollection import TCollection_ExtendedString
from OCP.TDataStd import TDataStd_Name
from OCP.TDF import TDF_Label
from OCP.collections import Sequence_TDF_Label as TDF_LabelSequence
from OCP.TDocStd import TDocStd_Document
from OCP.TopAbs import TopAbs_FACE, TopAbs_REVERSED
from OCP.TopExp import TopExp_Explorer
from OCP.TopLoc import TopLoc_Location
from OCP.TopoDS import TopoDS
from OCP.XCAFDoc import XCAFDoc_ColorGen, XCAFDoc_ColorSurf, XCAFDoc_DocumentTool, XCAFDoc_ShapeTool

src, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
lin_defl = float(sys.argv[3]) if len(sys.argv) > 3 else 0.2
out_dir.mkdir(parents=True, exist_ok=True)

doc = TDocStd_Document(TCollection_ExtendedString("doc"))
reader = STEPCAFControl_Reader()
reader.SetColorMode(True)
reader.SetNameMode(True)
if reader.ReadFile(str(src)) != IFSelect_RetDone:
    sys.exit("could not read STEP file")
print("transferring…", flush=True)
reader.Transfer(doc)

main = doc.Main()
shapes = XCAFDoc_DocumentTool.ShapeTool_s(main)
colors = XCAFDoc_DocumentTool.ColorTool_s(main)


def label_name(label):
    attr = TDataStd_Name()
    if label.FindAttribute(TDataStd_Name.GetID_s(), attr):
        return attr.Get().ToExtString()
    return ""


def shape_color(shape):
    c = Quantity_Color()
    for kind in (XCAFDoc_ColorSurf, XCAFDoc_ColorGen):
        if colors.GetColor(shape, kind, c):
            return (round(c.Red(), 3), round(c.Green(), 3), round(c.Blue(), 3))
    return None


def matrix(loc):
    t = loc.Transformation()
    rows = [[t.Value(r, c) for c in range(1, 5)] for r in range(1, 4)]
    m = [rows[r][c] for c in range(4) for r in range(3)]  # column-major 4x4 for three.js
    out = [0.0] * 16
    for c in range(4):
        for r in range(3):
            out[c * 4 + r] = rows[r][c]
    out[15] = 1.0
    return None if loc.IsIdentity() else out


blobs, offset = [], 0


def push(arr):
    global offset
    data = np.ascontiguousarray(arr).tobytes()
    blobs.append(data)
    start = offset
    offset += len(data)
    return start


def vertex_normals(pos, idx):
    tri = pos[idx]
    fn = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    nrm = np.zeros_like(pos)
    for k in range(3):
        np.add.at(nrm, idx[:, k], fn)
    ln = np.linalg.norm(nrm, axis=1, keepdims=True)
    ln[ln == 0] = 1
    return nrm / ln


protos = {}  # label tag -> proto index
proto_list = []


def build_proto(label, fallback_color):
    shape = XCAFDoc_ShapeTool.GetShape_s(label)
    BRepMesh_IncrementalMesh(shape, lin_defl, False, 0.5, True)
    part_color = shape_color(shape) or fallback_color
    by_color = {}
    exp = TopExp_Explorer(shape, TopAbs_FACE)
    while exp.More():
        face = TopoDS.Face(exp.Current())
        exp.Next()
        loc = TopLoc_Location()
        tri = BRep_Tool.Triangulation_s(face, loc)
        if tri is None:
            continue
        tr = loc.Transformation()
        n, m = tri.NbNodes(), tri.NbTriangles()
        pos = np.empty((n, 3), np.float64)
        for i in range(n):
            p = tri.Node(i + 1).Transformed(tr)
            pos[i] = (p.X(), p.Y(), p.Z())
        idx = np.empty((m, 3), np.uint32)
        flip = face.Orientation() == TopAbs_REVERSED
        for i in range(m):
            a, b, c = tri.Triangle(i + 1).Get()
            idx[i] = (a - 1, c - 1, b - 1) if flip else (a - 1, b - 1, c - 1)
        color = shape_color(face) or part_color
        by_color.setdefault(color, []).append((pos, idx))
    chunks = []
    for color, faces in by_color.items():
        base, ps, ids = 0, [], []
        for pos, idx in faces:
            ps.append(pos)
            ids.append(idx + base)
            base += len(pos)
        pos, idx = np.vstack(ps), np.vstack(ids)
        nrm = vertex_normals(pos, idx)
        chunks.append({
            "color": color,
            "vertices": len(pos),
            "triangles": len(idx),
            "pos": push(pos.astype("<f4")),
            "nrm": push(nrm.astype("<f4")),
            "idx": push(idx.astype("<u4")),
        })
    proto_list.append(chunks)
    return len(proto_list) - 1


def build_node(label, loc, fallback_color):
    """label: a component or free shape. Returns a tree node dict."""
    node = {"name": label_name(label)}
    if loc is not None:
        m = matrix(loc)
        if m:
            node["matrix"] = m
    target = TDF_Label()
    if XCAFDoc_ShapeTool.IsReference_s(label):
        XCAFDoc_ShapeTool.GetReferredShape_s(label, target)
        if not node["name"]:
            node["name"] = label_name(target)
    else:
        target = label
    color = shape_color(XCAFDoc_ShapeTool.GetShape_s(target)) or fallback_color
    if XCAFDoc_ShapeTool.IsAssembly_s(target):
        comps = TDF_LabelSequence()
        XCAFDoc_ShapeTool.GetComponents_s(target, comps)
        node["children"] = [
            build_node(comps.Value(i), XCAFDoc_ShapeTool.GetLocation_s(comps.Value(i)), color)
            for i in range(1, comps.Length() + 1)
        ]
    else:
        key = target.Tag()
        if key not in protos:
            protos[key] = build_proto(target, color)
            print(f"meshed {len(protos)} parts: {node['name']}", flush=True)
        node["proto"] = protos[key]
    return node


free = TDF_LabelSequence()
shapes.GetFreeShapes(free)
roots = [build_node(free.Value(i), None, None) for i in range(1, free.Length() + 1)]

(out_dir / "model.bin").write_bytes(b"".join(blobs))
(out_dir / "model.json").write_text(json.dumps({"roots": roots, "protos": proto_list}))
tris = sum(c["triangles"] for p in proto_list for c in p)
print(f"done: {len(proto_list)} unique parts, {tris:,} triangles, {offset / 1e6:.0f} MB", flush=True)
