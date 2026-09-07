const USER_FACING_ERROR_KIND = "userFacing";
const AI_CONSENT_REQUIRED_ERROR_CODE = "aiConsentRequired";

type UserFacingErrorCode = typeof AI_CONSENT_REQUIRED_ERROR_CODE;

export {
	AI_CONSENT_REQUIRED_ERROR_CODE,
	USER_FACING_ERROR_KIND,
	type UserFacingErrorCode,
};
