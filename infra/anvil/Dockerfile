FROM ghcr.io/foundry-rs/foundry:latest

EXPOSE 8545

ENTRYPOINT ["anvil", \
  "--fork-url", "https://mainnet.base.org", \
  "--chain-id", "8453", \
  "--host", "0.0.0.0", \
  "--port", "8545", \
  "--state", "/data/anvil-state.json"]
