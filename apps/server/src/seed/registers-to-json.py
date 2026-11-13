"""Hand-run, never in CI: machine registers (xlsx) -> cosmos-machines.json. Needs openpyxl==3.1.5.
python3 -I registers-to-json.py <xlsx> apps/server/src/seed/generated/cosmos-machines.json
Exits non-zero on a missing sheet, a missing header or a duplicate id."""
import datetime, json, sys

import openpyxl

# sheet -> (segment, id column)
SHEETS = {
    "CNC Machine Master": ("CNC", "Machine ID"),
    "Conventional Machines": ("Conventional", "Machine ID"),
    "Process Machines": ("Process", "Machine ID"),
    "DG Sets": ("DG", "DG ID"),
    "Utilities": ("Utility", "Machine ID"),
}
# output field -> (source column, kind)
FIELDS = {
    "category": ("Category", "text"), "make": ("Make", "text"), "model": ("Model", "text"),
    "serial": ("Serial No", "text"), "controller": ("Controller", "text"),
    "controllerModel": ("Ctrl Model", "text"), "controllerSerial": ("Ctrl Sr No", "text"),
    "year": ("Year", "int"), "purchasedOn": ("Date of Purchase", "date"),
    "powerKw": ("Power(KVA)", "num"), "location": ("Location", "text"), "cell": ("Cell", "text"),
    "assetCode": ("Asset Code", "text"), "capacityKva": ("Capacity(KVA)", "num"),
}


def clean(value, kind):
    if isinstance(value, (datetime.datetime, datetime.date)):
        return value.strftime("%Y-%m-%d") if kind == "date" else None
    text = str(value).strip() if value is not None else ""
    if text in ("", "None"):
        return None
    if kind in ("int", "num"):
        try:
            number = float(text)
        except ValueError:
            return None
        return int(number) if kind == "int" or number.is_integer() else number
    return text


def read_sheet(wb, name, segment, id_col, seen):
    if name not in wb.sheetnames:
        sys.exit(f"missing sheet: {name}")
    rows = list(wb[name].iter_rows(values_only=True))
    start = next((i for i, r in enumerate(rows) if str(r[0] or "").startswith("Sr.")), None)
    if start is None:
        sys.exit(f"missing header row: {name}")
    header = [str(h).strip() if h is not None else "" for h in rows[start]]
    out = []
    for row in rows[start + 1 :]:
        record = dict(zip(header, row))
        code = clean(record.get(id_col), "text")
        if code is None:
            continue
        if code in seen:
            sys.exit(f"duplicate id: {code}")
        seen.add(code)
        robot = segment == "CNC" and clean(record.get("Category"), "text") == "Robot"
        machine = {"code": code, "segment": "Robot" if robot else segment}
        for field, (column, kind) in FIELDS.items():
            machine[field] = clean(record.get(column), kind)
        out.append(machine)
    return out


def main(xlsx, target):
    wb = openpyxl.load_workbook(xlsx, data_only=True)
    seen, counts, machines = set(), {}, []
    for name, (segment, id_col) in SHEETS.items():
        found = read_sheet(wb, name, segment, id_col, seen)
        counts[name] = len(found)
        machines += found
    json.dump({"sheetCounts": counts, "machines": machines}, open(target, "w"), indent=1)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
