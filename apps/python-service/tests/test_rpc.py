import asyncio

from rpc.server import INVALID_PARAMS, METHOD_NOT_FOUND, RpcServer


def test_ping_returns_ok():
    server = RpcServer()
    response = asyncio.run(
        server.dispatch({"jsonrpc": "2.0", "id": 1, "method": "system.ping"})
    )
    assert response["result"]["status"] == "ok"
    assert response["result"]["pid"] > 0


def test_unknown_method_returns_error():
    server = RpcServer()
    response = asyncio.run(
        server.dispatch({"jsonrpc": "2.0", "id": 2, "method": "does.not.exist"})
    )
    assert response["error"]["code"] == METHOD_NOT_FOUND


def test_watch_rejects_invalid_device_id():
    server = RpcServer()
    response = asyncio.run(
        server.dispatch(
            {"jsonrpc": "2.0", "id": 3, "method": "device.watch", "params": {"deviceId": -1}}
        )
    )
    assert response["error"]["code"] == INVALID_PARAMS
