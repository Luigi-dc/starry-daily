#!/usr/bin/env python3
"""
Scarica le mappe globali reali di pianeti, lune e corpi minori dalle missioni NASA
(NASA Photojournal, NASA SVS, NASA Earth Observatory, NASA SDO e l'archivio USGS Astrogeology
che pubblica i mosaici delle missioni NASA) e produce le texture equirettangolari in
public/textures/, più src/data/texture-credits.json con i crediti di ogni mappa.

Requisiti: Python 3 con Pillow. Uso: python3 scripts/fetch-textures.py
I file originali (alcuni da centinaia di MB) restano in .texture-cache/ per non riscaricarli.

Tre tipi di sorgente:
- "map": mosaico globale già in proiezione cilindrica semplice;
- "map" con fill=soglia: mosaico con zone mai fotografate (nere), riempite con il colore medio della latitudine;
- "disk": per Saturno, Urano, Nettuno e il Sole non esistono mappe globali: si ricava il profilo
  di colore per latitudine da una foto reale del disco e, dove c'è dettaglio (project=True),
  si riproietta l'emisfero visibile sulla mappa.
"""
import json
import math
import os
import sys
import urllib.request

from PIL import Image, ImageFilter, ImageStat

Image.MAX_IMAGE_PIXELS = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".texture-cache")
OUT = os.path.join(ROOT, "public", "textures")
CREDITS = os.path.join(ROOT, "src", "data", "texture-credits.json")

PJ = "https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/{dir}/{low}/{pia}.jpg"
USGS = "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/"


def pj(pia):
    return PJ.format(dir="pia" + pia[3:5], low=pia.lower(), pia=pia)


BIG = (4096, 2048)
STD = (2048, 1024)

SOURCES = {
    "sun": dict(url="https://sdo.gsfc.nasa.gov/assets/img/latest/latest_2048_HMIIC.jpg", kind="disk", project=True, size=STD,
                credit="NASA/SDO, HMI (immagine del giorno in cui è stata generata la texture)"),
    "mercury": dict(url=pj("PIA15063"), size=BIG, tint=(1.0, 0.95, 0.9), level=0.42,
                    credit="NASA/Johns Hopkins APL/Carnegie Institution, MESSENGER (PIA15063)"),
    "venus": dict(url=USGS + "Venus_Magellan_C3-MDIR_Colorized_Global_Mosaic_4641m.tif", size=BIG,
                  credit="NASA/JPL/USGS, Magellan (radar della superficie, colorizzato)"),
    "earth": dict(url="https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/november/world.topo.bathy.200411.3x5400x2700.jpg",
                  size=BIG, credit="NASA Earth Observatory, Blue Marble Next Generation (novembre)"),
    "moon": dict(url="https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_4k.tif", size=BIG,
                 credit="NASA Scientific Visualization Studio, LRO/LROC (CGI Moon Kit)"),
    "mars": dict(url="https://astrogeology.usgs.gov/ckan/dataset/7131d503-cdc9-45a5-8f83-5126c0fd397e/resource/5ea881c6-01b3-41fa-a7af-42d2131b54f1/download/mars_viking_mdim21_clrmosaic_1km.jpg",
                 size=BIG, credit="NASA/JPL/USGS, Viking (MDIM 2.1 a colori)"),
    "phobos": dict(url=USGS + "Phobos_Viking_Mosaic_40ppd_DLRcontrol.tif", size=STD, tint=(0.62, 0.55, 0.48),
                   credit="NASA/JPL/USGS/DLR, Viking"),
    "jupiter": dict(url=pj("PIA07782"), size=BIG, credit="NASA/JPL/Space Science Institute, Cassini (PIA07782)"),
    "io": dict(url=USGS + "Io_GalileoSSI-Voyager_Global_Mosaic_ClrMerge_1km.tif", size=STD,
               credit="NASA/JPL/USGS, Galileo e Voyager"),
    "europa": dict(url=USGS + "Europa_Voyager_GalileoSSI_global_mosaic_500m.tif", size=STD, fill=3, tint=(1.0, 0.93, 0.84),
                   credit="NASA/JPL/USGS, Galileo e Voyager"),
    "ganymede": dict(url=USGS + "Ganymede_Voyager_GalileoSSI_Global_ClrMosaic_1435m.tif", size=STD, fill=3,
                     credit="NASA/JPL/USGS, Galileo e Voyager"),
    "callisto": dict(url=USGS + "Callisto_Voyager_GalileoSSI_global_mosaic_1km.tif", size=STD, fill=3, level=0.36, tint=(0.82, 0.74, 0.64),
                     credit="NASA/JPL/USGS, Galileo e Voyager"),
    "saturn": dict(url=pj("PIA11141"), kind="disk", project=False, size=STD, mask_equator=15, mirror_south=True,
                   credit="NASA/JPL/Space Science Institute, Cassini (profilo dei colori da PIA11141)"),
    "enceladus": dict(url=USGS + "Enceladus_Cassini_mosaic_global_110m.tif", size=STD, fill=3, tint=(0.97, 0.99, 1.0),
                      credit="NASA/JPL/Space Science Institute/USGS, Cassini"),
    "titan": dict(url=USGS + "Titan_ISS_P19658_Mosaic_Global_4km.tif", size=STD, tint=(0.95, 0.72, 0.42), haze=0.35,
                  credit="NASA/JPL/Space Science Institute/USGS, Cassini (superficie a 938 nm, tinta della foschia)"),
    "uranus": dict(url=pj("PIA18182"), kind="disk", project=False, size=STD,
                   credit="NASA/JPL, Voyager 2 (profilo dei colori da PIA18182)"),
    "neptune": dict(url=pj("PIA01492"), kind="disk", project=True, size=STD,
                    credit="NASA/JPL, Voyager 2 (da PIA01492)"),
    "triton": dict(url=USGS + "Triton_Voyager2_ClrMosaic_GlobalFill_600m.tif", size=STD, fill=3, olive_fill=True,
                   credit="NASA/JPL/USGS, Voyager 2 (il nord non è mai stato fotografato)"),
    "ceres": dict(url=USGS + "Ceres_Dawn_FC_DLR_global_20ppd_Oct2015.tif", size=STD, fill=3, tint=(0.86, 0.84, 0.82),
                  credit="NASA/JPL-Caltech/UCLA/MPS/DLR/IDA, Dawn"),
    "vesta": dict(url=USGS + "Vesta_Dawn_FC_HAMO_Mosaic_Global_74ppd.tif", size=STD, fill=3, tint=(0.92, 0.88, 0.82),
                  credit="NASA/JPL-Caltech/UCLA/MPS/DLR/IDA, Dawn"),
    "pluto": dict(url=pj("PIA19956"), fill=14, size=STD,
                  credit="NASA/Johns Hopkins APL/SwRI, New Horizons (PIA19956; il sud non è mai stato fotografato)"),
    "charon": dict(url=pj("PIA19866"), fill=14, size=STD, tint=(0.9, 0.86, 0.82),
                   credit="NASA/Johns Hopkins APL/SwRI, New Horizons (PIA19866; il sud non è mai stato fotografato)"),
}


def download(name, url):
    os.makedirs(CACHE, exist_ok=True)
    ext = ".tif" if url.lower().endswith(".tif") else ".jpg"
    path = os.path.join(CACHE, name + ext)
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path
    print(f"  scarico {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "starry-daily/1.0"})
    with urllib.request.urlopen(req, timeout=600) as res, open(path + ".part", "wb") as f:
        while True:
            chunk = res.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)
    os.replace(path + ".part", path)
    return path


def open_scaled(path, size):
    """Apre l'immagine riducendola già in decodifica quando è enorme."""
    im = Image.open(path)
    if im.format == "JPEG":
        im.draft("RGB", (size[0] * 2, size[1] * 2))
    if im.mode not in ("RGB", "L"):
        im = im.convert("RGB")
    factor = max(1, min(im.width // (size[0] * 2), im.height // (size[1] * 2)))
    if factor > 1:
        im = im.reduce(factor)
    return im


def tinted(im, tint, haze=0.0):
    """Le mappe in bianco e nero prendono il colore medio reale del corpo."""
    if im.mode == "L":
        im = im.convert("RGB")
    if tint:
        r, g, b = im.split()
        r = r.point(lambda v: min(255, v * tint[0]))
        g = g.point(lambda v: min(255, v * tint[1]))
        b = b.point(lambda v: min(255, v * tint[2]))
        im = Image.merge("RGB", (r, g, b))
        if haze:
            flat = Image.new("RGB", im.size, tuple(int(255 * c * 0.8) for c in tint))
            im = Image.blend(im, flat, haze)
    return im


def fill_unseen(im, threshold, olive=False):
    """Riempie le zone nere (mai fotografate o senza dati) con il colore medio della stessa latitudine.
    Con olive=True tratta come «senza dati» anche il riempimento verde oliva uniforme del mosaico USGS di Tritone."""
    gray = im.convert("L")
    mask = gray.point(lambda v: 255 if v > threshold else 0)
    if olive:
        px = im.load()
        mp = mask.load()
        for y in range(im.height):
            for x in range(im.width):
                r, g, b = px[x, y]
                if b < 0.72 * g and g < 130:
                    mp[x, y] = 0
    overall = tuple(int(c) for c in ImageStat.Stat(im, mask).mean)
    w, h = im.size
    rows = []
    last = None
    for y in range(h):
        row_mask = mask.crop((0, y, w, y + 1))
        coverage = ImageStat.Stat(row_mask).mean[0] / 255
        if coverage > 0.04:
            stat = ImageStat.Stat(im.crop((0, y, w, y + 1)), row_mask)
            last = tuple(int(c) for c in stat.mean)
            rows.append(last)
        else:
            # nessun dato su questa latitudine: colore medio del corpo (la sfocatura raccorda i bordi)
            rows.append(overall)
    fill = Image.new("RGB", (1, h))
    for y, c in enumerate(rows):
        fill.putpixel((0, y), c)
    fill = fill.resize((w, h), Image.BILINEAR).filter(ImageFilter.GaussianBlur(6))
    soft = mask.filter(ImageFilter.GaussianBlur(4))
    return Image.composite(im, fill, soft)


def leveled(im, target):
    """Porta la luminosità media al valore indicato (mappe molto scure, come Mercurio)."""
    mean = ImageStat.Stat(im.convert("L")).mean[0]
    factor = target * 255 / max(1, mean)
    return im.point(lambda v: min(255, int(v * factor)))


def smoothstep(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def disk_geometry(photo):
    """Centro e raggio del disco nella foto. Si lavora su una copia ridotta e sfocata, così il rumore
    JPEG ai bordi non conta; gli anelli di Saturno, visti quasi di taglio, non cambiano l'altezza."""
    k = 4
    gray = photo.convert("L").reduce(k).filter(ImageFilter.GaussianBlur(2)).point(lambda v: 255 if v > 40 else 0)
    x0, y0, x1, y1 = gray.getbbox()
    cy = (y0 + y1) / 2
    radius = (y1 - y0) / 2
    row = gray.crop((0, int(cy - radius * 0.5), gray.width, int(cy - radius * 0.5) + 1))
    xs = [x for x in range(gray.width) if row.getpixel((x, 0)) > 0]
    # a metà altezza la corda vale √3·R: il centro è a metà della corda
    cx = (xs[0] + xs[-1]) / 2
    return cx * k, cy * k, radius * k


def disk_to_map(photo, size, project, mask_equator=0, mirror_south=False):
    w, h = size
    cx, cy, radius = disk_geometry(photo)
    photo = photo.convert("RGB")

    # profilo di colore per latitudine lungo il meridiano centrale, corretto per l'oscuramento al bordo
    profile = []
    for j in range(h):
        lat = 90 - (j + 0.5) * 180 / h
        # oltre ±70° il bordo del disco è troppo scorciato: i poli prendono il colore della fascia a 70°
        ls = max(-70.0, min(70.0, lat))
        y = cy - radius * math.sin(math.radians(ls))
        half = max(2, radius * 0.05 * math.cos(math.radians(ls)))
        box = (int(cx - half), int(y - 1), int(cx + half) + 1, int(y + 2))
        mean = ImageStat.Stat(photo.crop(box)).mean
        k = 1 / (0.4 + 0.6 * math.cos(math.radians(ls)))
        profile.append([min(255.0, c * k) for c in mean])
    # righe in ombra o fuori dal disco (più scure di un terzo della mediana): si usa la riga valida più vicina
    lum = [sum(c) / 3 for c in profile]
    median = sorted(lum)[len(lum) // 2]
    valid = [l > median / 3 for l in lum]
    for j in range(h):
        if not valid[j]:
            near = min((abs(i - j), i) for i in range(h) if valid[i])[1]
            profile[j] = list(profile[near])
    if mirror_south:
        # l'emisfero sud nella foto è coperto dagli anelli e dalla loro ombra: si usano le fasce del nord
        for j in range(h // 2, h):
            profile[j] = list(profile[h - 1 - j])
    if mask_equator:
        # gli anelli attraversano il disco all'equatore: lì si interpola tra le due fasce vicine
        # la fascia equatoriale prende il colore della zona chiara appena fuori dalla parte coperta
        row_at = lambda lat: next(j for j in range(h) if 90 - (j + 0.5) * 180 / h < lat)
        top, bottom = row_at(mask_equator), row_at(-mask_equator)
        north, south = profile[row_at(mask_equator + 6)], profile[row_at(-mask_equator - 6)]
        for j in range(top, bottom):
            t = (j - top) / max(1, bottom - top)
            profile[j] = [a + (b - a) * t for a, b in zip(north, south)]
    smooth = []
    for j in range(h):
        window = profile[max(0, j - 6): j + 7]
        smooth.append(tuple(int(sum(c[i] for c in window) / len(window)) for i in range(3)))

    bands = Image.new("RGB", (1, h))
    for j, c in enumerate(smooth):
        bands.putpixel((0, j), c)
    out = bands.resize((w, h), Image.BILINEAR)
    if not project:
        return out

    # parte centrale del disco riproiettata: dettagli reali (macchie, nubi) dove la foto è nitida
    src = photo.load()
    dst = out.load()
    for j in range(h):
        lat = math.radians(90 - (j + 0.5) * 180 / h)
        for i in range(w):
            lon = math.radians((i + 0.5) * 360 / w - 180)
            if abs(lon) > math.radians(60):
                continue
            mu = math.cos(lat) * math.cos(lon)
            weight = smoothstep(math.radians(60), math.radians(25), abs(lon)) * smoothstep(0.45, 0.7, mu)
            if weight <= 0:
                continue
            x = cx + radius * math.cos(lat) * math.sin(lon)
            y = cy - radius * math.sin(lat)
            if not (0 <= x < photo.width - 1 and 0 <= y < photo.height - 1):
                continue
            p = src[int(x), int(y)]
            k = 1 / (0.4 + 0.6 * mu)
            b = dst[i, j]
            dst[i, j] = tuple(int(b[c] * (1 - weight) + min(255, p[c] * k) * weight) for c in range(3))
    return out


def build(name, spec):
    path = download(name, spec["url"])
    size = spec["size"]
    if spec.get("kind") == "disk":
        im = disk_to_map(Image.open(path), size, spec.get("project", False), spec.get("mask_equator", 0), spec.get("mirror_south", False))
    else:
        im = open_scaled(path, size)
        im = im.resize(size, Image.LANCZOS)
        if spec.get("level"):
            im = leveled(im, spec["level"])
        im = tinted(im, spec.get("tint"), spec.get("haze", 0.0))
        if spec.get("fill"):
            im = fill_unseen(im.convert("RGB"), spec["fill"], spec.get("olive_fill", False))
    os.makedirs(OUT, exist_ok=True)
    im.convert("RGB").save(os.path.join(OUT, f"{name}.jpg"), quality=86, optimize=True, progressive=True)


def main():
    only = set(sys.argv[1:])
    credits = {}
    if os.path.exists(CREDITS):
        with open(CREDITS) as f:
            credits = json.load(f)
    for name, spec in SOURCES.items():
        if only and name not in only:
            continue
        print(name)
        build(name, spec)
        credits[name] = {"credit": spec["credit"], "source": spec["url"]}
    with open(CREDITS, "w") as f:
        json.dump(credits, f, ensure_ascii=False, indent=2)
    print(f"texture in {OUT}, crediti in {CREDITS}")


if __name__ == "__main__":
    main()
