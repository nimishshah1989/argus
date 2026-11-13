H='-H X-Client:tst -H X-Key:k123 -H Content-Type:application/json'; U=localhost:8799
j(){ python3 -c "import sys,json;d=json.load(sys.stdin);print(json.dumps(d)[:$1])"; }
ID=$(curl -s $H $U/api/state | python3 -c "import sys,json;print(json.load(sys.stdin)['open'][0]['id'])")
echo start; curl -s $H -d "{\"id\":\"$ID\",\"by\":\"Raj\"}" $U/api/start | j 90
echo transfer-before-note; curl -s $H -d "{\"id\":\"$ID\",\"by\":\"Raj\"}" $U/api/transfer | j 120
echo transfer; curl -s $H -d "{\"id\":\"$ID\",\"by\":\"Raj\",\"to\":\"Shift 2\",\"note\":\"Replaced belt, check alignment\"}" $U/api/transfer | python3 -c "import sys,json;t=json.load(sys.stdin)['ticket'];print(t['status'],t['handedOver'],t['transfers'],t['transferTo'])"
echo update; curl -s $H -d "{\"id\":\"$ID\",\"by\":\"Amit\",\"text\":\"Waiting for spindle\",\"spare\":\"Spindle 7.5kW from supplier\",\"eta\":\"2026-11-01T10:00:00Z\"}" $U/api/update | python3 -c "import sys,json;t=json.load(sys.stdin)['ticket'];print(t['eta'],t['waitSpare'])"
echo pickup; curl -s $H -d "{\"id\":\"$ID\",\"by\":\"Sunil\"}" $U/api/start | python3 -c "import sys,json;t=json.load(sys.stdin)['ticket'];print(t['status'],t['startedBy'],t['responseMin'],t['handoverWaitMin'])"
echo state; curl -s $H $U/api/state | python3 -c "import sys,json;t=json.load(sys.stdin)['open'][0];print(len(t['updates']),[u['type'] for u in t['updates']])"
echo closeNoReport; curl -s $H -d "{\"id\":\"$ID\",\"by\":\"Sunil\",\"kind\":\"no_report\",\"note\":\"busy\"}" $U/api/close | python3 -c "import sys,json;t=json.load(sys.stdin)['ticket'];print(t['status'],t['repairMin'],t['downtimeMin'],t['handoverWaitMin'])"
curl -s $H $U/api/state | python3 -c "import sys,json;d=json.load(sys.stdin);print('needReport',len(d['needReport']))"
echo report; curl -s $H -d "{\"id\":\"$ID\",\"by\":\"Sunil\",\"report\":{\"cause\":\"belt\",\"fix\":\"replaced\"}}" $U/api/report | j 60
curl -s $H "$U/api/history?days=7&reports=1" | python3 -c "import sys,json;t=json.load(sys.stdin)['tickets'][0];print(t['closeKind'],t['report'])"
curl -s $H "$U/api/state" | python3 -c "import sys,json;d=json.load(sys.stdin);print('needReport',len(d['needReport']))"
curl -s $H "$U/api/events?id=$ID" | python3 -c "import sys,json;print([e['type'] for e in json.load(sys.stdin)['events']])"
echo close-with-report-data; curl -s $H -d '{"machine":"VC-2","by":"Ram","problem":"x"}' $U/api/down | python3 -c "import sys,json;print(json.load(sys.stdin)['ticket']['id'])" > /tmp/id2
ID2=$(cat /tmp/id2); curl -s $H -d "{\"id\":\"$ID2\",\"by\":\"Raj\",\"kind\":\"report\",\"report\":{\"cause\":\"x\"}}" $U/api/close | python3 -c "import sys,json;t=json.load(sys.stdin)['ticket'];print(t['status'],t['hasReport'])"
echo origin-post; curl -s -H "Origin: https://evil.com" $H -d '{"machine":"VC-3","by":"R","problem":"x"}' $U/api/down | j 80
echo origin-get; curl -s -H "Origin: null" $H $U/api/state | j 60
