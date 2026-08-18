const GAS_URL = 'https://script.google.com/macros/s/AKfycbxk6iwhd7XTxlriVJCK0YmJXGKoLq1ZEkP7b9SJnrGU6Cs0h6ed3N0bfoSYzy7ZfewBYQ/exec';

async function forward(method, request) {
  try {
    const target = new URL(GAS_URL);
    if (method === 'GET') {
      const incoming = new URL(request.url);
      target.searchParams.set('action', incoming.searchParams.get('action') || 'all');
      target.searchParams.set('_', Date.now().toString());
    }

    const init = {
      method,
      redirect: 'follow',
      cache: 'no-store',
      headers: { 'Accept': 'application/json' },
    };

    if (method === 'POST') {
      init.headers['Content-Type'] = 'text/plain;charset=utf-8';
      init.body = await request.text();
    }

    const upstream = await fetch(target, init);
    const text = await upstream.text();
    let parsed;
    try { parsed = JSON.parse(text); }
    catch {
      return Response.json({
        ok: false,
        error: 'Google Apps Script 응답을 읽지 못했습니다. 웹 앱의 액세스 권한을 모든 사용자로 설정했는지 확인해주세요.'
      }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
    }

    return Response.json(parsed, {
      status: upstream.ok ? 200 : 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return Response.json({ ok: false, error: String(error?.message || error) }, {
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}

export function GET(request) {
  return forward('GET', request);
}

export function POST(request) {
  return forward('POST', request);
}
