#!/bin/bash
# Downloads the Yunara game files the build needs from CommunityDragon into $1.
set -e
DEST="${1:?usage: fetch_game_files.sh <dir>}"
B=https://raw.communitydragon.org/latest/game
mkdir -p "$DEST/png" "$DEST/data/characters/yunara/skins" "$DEST/assets/characters/yunara/skins/base"
curl -sf -o "$DEST/data/characters/yunara/skins/skin0.bin" "$B/data/characters/yunara/skins/skin0.bin"
curl -sf -o "$DEST/assets/characters/yunara/skins/base/yunara_base.skn" "$B/assets/characters/yunara/skins/base/yunara_base.skn"
curl -sf -o "$DEST/body_tx.png" "$B/assets/characters/yunara/skins/base/yunara_base_tx_cm.png"
for n in yunara_base_q_beamcolorgradmult yunara_base_passive_orb01 yunara_base_w_bgswirl yunaravisdev_grad01 \
         yunara_base_w_headdiffuse yunara_skin01_petal yunara_base_tile01 yunara_base_q_orb01 yunara_base_ba_orb01 \
         yunara_base_trail10 yunara_base_spiritguard_recallwater02; do
  curl -sf -o "$DEST/png/assets_characters_yunara_skins_base_particles_$n.png" \
       "$B/assets/characters/yunara/skins/base/particles/$n.png"
done
echo "game files ready in $DEST"
