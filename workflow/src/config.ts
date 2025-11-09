export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const ROUTES = {
  TAGS: '/tags',
  TAG_APPROVAL: '/approval-for-ai-tagging',
	ALTTEXT:'/alttext',
	ALTTEXT_APPROVAL: '/approval-for-ai-alttext',
} as const;

export const AI_TAGS_CONFIG = {
  MODEL: '@cf/llava-hf/llava-1.5-7b-hf',
  PROMPT: 'Give me 5 different single word description tags for the image. Return them as a comma separated list with only the tags, no other text.',
  MAX_TOKENS: 512,
} as const;

export const AI_ALT_TEXT_CONFIG = {
  MODEL: '@cf/llava-hf/llava-1.5-7b-hf',
  PROMPT: 'Give me an alt text description for this image, return this as a single setence with only the alt text description, no other text',
  MAX_TOKENS: 512,
} as const;

export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  INTERNAL_SERVER_ERROR: 500,
} as const;
