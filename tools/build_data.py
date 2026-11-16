#!/usr/bin/env python3
"""Legge data/catalogo.txt e genera data/catalogo.json e js/data.js.

Uso:  python3 tools/build_data.py

Per aggiungere parole basta modificare data/catalogo.txt (stesso formato
delle righe esistenti) e rilanciare lo script.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "catalogo.txt"
OUT_JSON = ROOT / "data" / "catalogo.json"
OUT_JS = ROOT / "js" / "data.js"

SECTIONS = {"1": "char", "2": "particle", "3": "word", "4": "piece"}

# Risposte accettate in più rispetto a quelle scritte nel catalogo
# (sinonimi, femminili/plurali, forme abbreviate). Chiave: carattere/i.
EXTRA_ANSWERS = {
    "人": ["essere umano", "uomo"],
    "医": ["medico", "dottore"],
    "早": ["mattino"],
    "再": ["ancora", "nuovamente"],
    "老": ["anziano"],
    "师": ["insegnante"],
    "回": ["ritornare"],
    "大": ["grosso"],
    "女": ["femmina"],
    "室": ["camera"],
    "妈": ["madre"],
    "妈妈": ["madre"],
    "它": ["essa"],
    "是": ["sono"],
    "山": ["monte"],
    "这": ["questa"],
    "那": ["quella"],
    "我的": ["mia", "miei", "mie"],
    "你的": ["tua", "tuoi", "tue"],
    "他的": ["sua", "suoi", "sue"],
    "了": ["azione compiuta", "cambiamento", "finire"],
    "们": ["plurale", "suffisso plurale", "plurale per persone"],
    "吗": ["particella interrogativa", "domanda", "rende la frase una domanda"],
    "啊": ["calore", "particella di calore"],
    "啦": ["amichevole", "particella amichevole"],
    "儿": ["r", "suffisso r", "bambino"],
    "你好": ["salve"],
    "再见": ["a rivederci", "ci vediamo"],
    "早啊": ["buon giorno", "buondì"],
    "回来啦": ["eccoti", "sei tornato", "bentornato"],
    "去哪儿啊": ["dove vai"],
    "嗨": ["hi", "hey"],
    "哈喽": ["ciao", "salve"],
    "晚上好": ["buona sera"],
    "中文": ["cinese"],
    "汉语": ["cinese"],
    "外国": ["straniero"],
    "老师": ["professore", "maestro", "insegnante"],
    "医生": ["medico"],
    "同学": ["compagno", "compagna di classe", "compagna"],
    "朋友": ["amica"],
    "室友": ["coinquilina"],
    "邻居": ["vicino", "vicina"],
    "老板": ["boss"],
    "我说中文": ["parlo il cinese", "io parlo cinese"],
    "回来": ["ritornare"],
    "回去": ["ritornare"],
    "上网": ["navigare", "connettersi"],
    "早上": ["mattina"],
    "晚上": ["serata"],
}

# Altre letture del pinyin accettate
EXTRA_PINYIN = {
    "了": ["liǎo"],
    "谁": ["shuí"],
}

BULLET = re.compile(r"^•\s*(?P<hanzi>\S+)\s+(?P<pinyin>[^:=]+?)\s*:\s*(?P<rest>.+)$")
COMPOUND = re.compile(r"^•\s*(?P<hanzi>\S+)\s+(?P<pinyin>\S+)\s*=\s*(?P<parts>.+)$")
PART = re.compile(r"^(?P<h>\S)(?:\s+(?P<p>[^\s(]+))?(?:\s*\((?P<role>[^)]*)\))?$")


def die(msg, line=None):
    where = f" (riga: {line!r})" if line else ""
    sys.exit(f"Errore nel catalogo: {msg}{where}")


def split_meaning(rest):
    """'vecchio (prefisso di rispetto)' -> ('vecchio', ['prefisso di rispetto'])"""
    notes = [n.strip() for n in re.findall(r"\(([^)]*)\)", rest)]
    main = re.sub(r"\s*\([^)]*\)", "", rest).strip()
    return main, notes


def answers_from(main, hanzi):
    parts = [p.strip() for p in re.split(r"[,;]", main) if p.strip()]
    out = []
    for a in [main] + parts + EXTRA_ANSWERS.get(hanzi, []):
        if a and a not in out:
            out.append(a)
    return out


def merge_unique(base, extra):
    for a in extra:
        if a not in base:
            base.append(a)


def parse():
    text = SRC.read_text(encoding="utf-8")
    entries = []          # tutte le voci studiabili
    by_key = {}           # (hanzi, pinyin) -> entry, per i duplicati
    by_hanzi = {}         # hanzi -> entry (primo trovato non-parola)
    compounds = []
    groups = []
    section = None
    group = None
    picture_rows = []
    compound_rows = []
    piece_rows = []
    memo = []

    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith(("Catalogo cinese", "Formato:")):
            continue
        m = re.match(r"^(\d)\.\s+(.*)$", line)
        if m:
            section = SECTIONS.get(m.group(1))
            if section is None:
                die("sezione sconosciuta", line)
            group = None
            continue
        if not line.startswith("•"):
            if section == "word":
                group = line
                if group not in groups:
                    groups.append(group)
            elif section in ("piece", "compound", "picture", "memo"):
                if line.startswith("Caratteri composti"):
                    section = "compound"
                elif line.startswith("Caratteri disegno"):
                    section = "picture"
                elif line.startswith("Da imparare a memoria"):
                    section = "memo"
                else:
                    die("titolo non riconosciuto", line)
            else:
                die("titolo inatteso", line)
            continue

        # ---- righe con elenco puntato ----
        if section == "compound":
            mm = COMPOUND.match(line)
            if not mm:
                die("riga composta non valida", line)
            compound_rows.append(mm)
            continue
        if section == "picture":
            left, sep, right = line.partition(" = ")
            if not sep:
                die("manca '=' nella riga disegno", line)
            picture_rows.append((left.lstrip("•").strip(), right))
            continue

        mm = BULLET.match(line)
        if not mm:
            die("riga non valida", line)
        hanzi, pinyin = mm.group("hanzi"), mm.group("pinyin").strip()
        main, notes = split_meaning(mm.group("rest"))

        if section == "memo":
            memo.append(hanzi)
            continue
        if section == "piece":
            piece_rows.append((hanzi, pinyin, main, notes))
            continue

        key = (hanzi, pinyin)
        if key in by_key:                      # es. 谁 compare due volte
            e = by_key[key]
            tag = f"word:{group}" if section == "word" and group else None
            if tag and tag not in e["tags"]:
                e["tags"].append(tag)
            if section == "word" and "word" not in e["tags"]:
                e["tags"].append("word")
            continue
        tags = [section]
        if section == "word":
            tags.append(f"word:{group}")
        e = {
            "id": f"{section}:{hanzi}",
            "hanzi": hanzi,
            "pinyin": pinyin,
            "altPinyin": EXTRA_PINYIN.get(hanzi, []),
            "meaning": main,
            "answers": answers_from(main, hanzi),
            "note": "; ".join(notes),
            "type": section,
            "group": group if section == "word" else None,
            "tags": tags,
            "speak": section in ("char", "word") or hanzi == "儿",
        }
        entries.append(e)
        by_key[key] = e
        if section in ("char", "particle"):
            by_hanzi.setdefault(hanzi, e)

    # ---- pezzi: unire con i caratteri uguali, altrimenti nuove voci ----
    for hanzi, pinyin, main, notes in piece_rows:
        e = by_hanzi.get(hanzi)
        if e:
            if "piece" not in e["tags"]:
                e["tags"].append("piece")
            merge_unique(e["answers"], answers_from(main, hanzi))
            have = [p.strip() for p in e["meaning"].split(",")]
            merge_unique(have, [p.strip() for p in main.split(",") if p.strip()])
            e["meaning"] = ", ".join(have)
            extra = [n for n in notes if n not in e["note"]]
            if extra:
                e["note"] = "; ".join(filter(None, [e["note"]] + extra))
        else:
            e = {
                "id": f"piece:{hanzi}",
                "hanzi": hanzi,
                "pinyin": pinyin,
                "altPinyin": [],
                "meaning": main,
                "answers": answers_from(main, hanzi),
                "note": "; ".join(notes),
                "type": "piece",
                "group": None,
                "tags": ["piece"],
                "speak": False,
            }
            entries.append(e)
            by_key[(hanzi, pinyin)] = e
            by_hanzi[hanzi] = e

    # ---- caratteri disegno: voci nuove (se mancano) + composti ----
    pieces_py = {e["hanzi"]: e["pinyin"] for e in entries if "piece" in e["tags"]}

    def lookup_py(h):
        e = by_hanzi.get(h)
        return e["pinyin"] if e else None

    for left, right in picture_rows:
        mm = BULLET.match("• " + left)
        if not mm:
            die("riga disegno non valida", left)
        hanzi, pinyin = mm.group("hanzi"), mm.group("pinyin").strip()
        main, notes = split_meaning(mm.group("rest"))
        parts = [p.strip() for p in right.split("+")]
        for p in parts:
            if p not in by_hanzi:
                die(f"pezzo {p} non presente nell'elenco dei pezzi", left)
        e = by_hanzi.get(hanzi)
        if not e:
            e = {
                "id": f"char:{hanzi}",
                "hanzi": hanzi,
                "pinyin": pinyin,
                "altPinyin": [],
                "meaning": main,
                "answers": answers_from(main, hanzi),
                "note": "; ".join(notes),
                "type": "char",
                "group": None,
                "tags": ["char"],
                "speak": True,
            }
            entries.append(e)
            by_hanzi[hanzi] = e
        compounds.append({
            "id": f"comp:{hanzi}",
            "hanzi": hanzi,
            "pinyin": pinyin,
            "kind": "picture",
            "entry": e["id"],
            "meaning": e["meaning"],
            "parts": [{"hanzi": p, "pinyin": lookup_py(p)} for p in parts],
        })

    # ---- composti significato + suono ----
    for mm in compound_rows:
        hanzi, pinyin = mm.group("hanzi"), mm.group("pinyin")
        raw_parts = [p.strip() for p in mm.group("parts").split("+")]
        if len(raw_parts) != 2:
            die("un composto deve avere due parti", mm.group(0))
        parsed = []
        for rp in raw_parts:
            pm = PART.match(rp)
            if not pm:
                die("parte non valida", rp)
            parsed.append(pm)
        sense, sound = parsed
        for pm, expected in ((sense, "significato"), (sound, "suono")):
            if pm.group("role") and pm.group("role") != expected:
                die(f"ruolo atteso '{expected}'", mm.group(0))
        if not sound.group("p"):
            die("manca il pinyin del pezzo che dà il suono", mm.group(0))
        if sense.group("h") not in by_hanzi:
            die(f"pezzo {sense.group('h')} non presente nei pezzi", mm.group(0))
        e = by_hanzi.get(hanzi)
        compounds.append({
            "id": f"comp:{hanzi}",
            "hanzi": hanzi,
            "pinyin": pinyin,
            "kind": "phonetic",
            "entry": e["id"] if e else None,
            "meaning": e["meaning"] if e else None,
            "parts": [
                {"hanzi": sense.group("h"), "pinyin": lookup_py(sense.group("h")), "role": "sense"},
                {"hanzi": sound.group("h"), "pinyin": sound.group("p"), "role": "sound"},
            ],
        })

    # ---- da imparare a memoria ----
    for h in memo:
        e = by_hanzi.get(h)
        if not e:
            die(f"{h} (da imparare a memoria) non esiste tra le voci")
        if "memo" not in e["tags"]:
            e["tags"].append("memo")

    return entries, compounds, groups


def validate(entries, compounds):
    ids = [e["id"] for e in entries]
    if len(ids) != len(set(ids)):
        dup = {i for i in ids if ids.count(i) > 1}
        die(f"id duplicati: {sorted(dup)}")
    for e in entries:
        if not e["answers"]:
            die(f"nessuna risposta per {e['hanzi']}")
    cids = [c["id"] for c in compounds]
    if len(cids) != len(set(cids)):
        die("composti duplicati")


def main():
    entries, compounds, groups = parse()
    validate(entries, compounds)
    data = {
        "groups": groups,
        "entries": entries,
        "compounds": compounds,
    }
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JS.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    OUT_JS.write_text(
        "/* File generato da tools/build_data.py: non modificarlo a mano. */\n"
        "window.CN = window.CN || {};\n"
        "window.CN.data = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    by_type = {}
    for e in entries:
        by_type[e["type"]] = by_type.get(e["type"], 0) + 1
    n_piece = sum(1 for e in entries if "piece" in e["tags"])
    print(f"Voci: {len(entries)}  ({by_type})")
    print(f"Pezzi: {n_piece}  Composti: {len(compounds)}  Gruppi di parole: {len(groups)}")
    print(f"Scritti: {OUT_JSON.relative_to(ROOT)}, {OUT_JS.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
