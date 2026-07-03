"""Data-core sidecar entry point.

Spawned and supervised by the Electron main process (python-manager.ts).
Speaks JSON-RPC 2.0 over stdio; never opens network ports.
"""

import asyncio

from rpc.server import RpcServer


def main() -> None:
    asyncio.run(RpcServer().run())


if __name__ == "__main__":
    main()
