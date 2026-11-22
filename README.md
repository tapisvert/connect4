# connect4

Connect 4 for the [tapis](https://github.com/tapisvert/tapis) engine, with a
terminal client.

```
npm install
node src/cli.ts host                    # prints the address to give the players
node src/cli.ts play 192.168.1.20:7474  # on each player's machine
```

Moves are column numbers, 1 to 7. `play` prints a seat token; pass it back
with `--token` to rejoin the same seat after a disconnect. `--auto` plays
random legal moves; the end-to-end test runs two of those
against a host.

The game itself is [`src/game.ts`](src/game.ts): one `drop` action, a global
scene, no secrets. Any gRPC client speaking
[`tapis.proto`](https://github.com/tapisvert/tapis/blob/main/proto/tapis.proto)
can play it.

MIT licensed.
