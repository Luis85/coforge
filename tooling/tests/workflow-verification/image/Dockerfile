ARG BASE_IMAGE
FROM ${BASE_IMAGE}
COPY --chmod=0555 fixture-dependency/ /opt/coforge/node_modules/fixture-dependency/
# Deliberately hostile image defaults: the production broker must clear these before its trusted controller starts.
ENV NODE_OPTIONS=--require=/source/preload.cjs
ENV COFORGE_IMAGE_CANARY=must-not-reach-test-environment
