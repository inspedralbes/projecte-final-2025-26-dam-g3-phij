import inviernoCampaign from '../../images/valkrypt_assets/campaigns/invierno.jpg';
import piedraprofundaCampaign from '../../images/valkrypt_assets/campaigns/piedraprofunda.jpg';
import saveFallbackCampaign from '../../images/valkrypt_assets/campaigns/save-fallback.jpg';
import dynamicThreatIcon from '../../images/valkrypt_assets/icons/dynamic-threat.jpg';
import narrativeProgressIcon from '../../images/valkrypt_assets/icons/narrative-progress.jpg';
import tacticalSquadIcon from '../../images/valkrypt_assets/icons/tactical-squad.jpg';

export const CAMPAIGN_IMAGE_KEYS = Object.freeze({
  PIEDRAPROFUNDA: 'campaign:piedraprofunda',
  INVIERNO: 'campaign:invierno'
});

export const valkryptFeatureImages = Object.freeze({
  tacticalSquad: tacticalSquadIcon,
  dynamicThreat: dynamicThreatIcon,
  narrativeProgress: narrativeProgressIcon
});

export const DEFAULT_CAMPAIGN_IMAGE = saveFallbackCampaign;
export const DEFAULT_GAME_BACKGROUND = saveFallbackCampaign;

const CAMPAIGN_IMAGES = Object.freeze({
  [CAMPAIGN_IMAGE_KEYS.PIEDRAPROFUNDA]: piedraprofundaCampaign,
  [CAMPAIGN_IMAGE_KEYS.INVIERNO]: inviernoCampaign
});

const normalizeToken = (value) => (
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
);

export const resolveCampaignAssetKey = (meta = {}) => {
  const source = typeof meta === 'string' ? { img: meta } : meta;
  const candidates = [
    source?.campaignId,
    source?.id,
    source?.slug,
    source?.title,
    source?.location,
    source?.img
  ]
    .map(normalizeToken)
    .filter(Boolean);

  for (const candidate of candidates) {
    if (candidate.includes('piedraprofunda')) {
      return CAMPAIGN_IMAGE_KEYS.PIEDRAPROFUNDA;
    }

    if (
      candidate === 'minas'
      || candidate.includes('invierno')
      || candidate.includes('minas-del-norte')
      || candidate.includes('norte')
    ) {
      return CAMPAIGN_IMAGE_KEYS.INVIERNO;
    }
  }

  return '';
};

export const resolveCampaignImage = (meta = {}, fallback = DEFAULT_CAMPAIGN_IMAGE) => {
  const source = typeof meta === 'string' ? { img: meta } : meta;
  const assetKey = resolveCampaignAssetKey(source);

  if (assetKey && CAMPAIGN_IMAGES[assetKey]) {
    return CAMPAIGN_IMAGES[assetKey];
  }

  const rawImage = String(source?.img || '').trim();
  if (rawImage) {
    return rawImage;
  }

  return fallback;
};
