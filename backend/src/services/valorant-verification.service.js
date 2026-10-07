const config =
  require('../config/env');

const AppError =
  require('../utils/app-error');


function normalizeRiotValue(value) {
  return String(value || '')
    .trim();
}


async function lookupValorantAccount(
  gameName,
  tagLine
) {
  const normalizedGameName =
    normalizeRiotValue(gameName);

  const normalizedTagLine =
    normalizeRiotValue(tagLine);

  if (
    !normalizedGameName ||
    !normalizedTagLine
  ) {
    throw new AppError(
      'Riot ID and Tag are required.',
      422,
      'RIOT_ID_REQUIRED'
    );
  }

  if (!config.riot?.apiKey) {
    throw new AppError(
      'Riot API is not configured.',
      503,
      'RIOT_API_NOT_CONFIGURED'
    );
  }

  const baseUrl =
    String(
      config.riot.accountBaseUrl ||
      'https://asia.api.riotgames.com'
    ).replace(/\/+$/, '');

  const url =
    `${baseUrl}` +
    '/riot/account/v1/accounts/by-riot-id/' +
    encodeURIComponent(
      normalizedGameName
    ) +
    '/' +
    encodeURIComponent(
      normalizedTagLine
    );

  let response;

  try {
    response =
      await fetch(
        url,
        {
          method: 'GET',

          headers: {
            Accept:
              'application/json',

            'X-Riot-Token':
              config.riot.apiKey,
          },

          signal:
            AbortSignal.timeout(
              8000
            ),
        }
      );

  } catch (error) {
    if (
      error?.name ===
        'TimeoutError' ||
      error?.name ===
        'AbortError'
    ) {
      throw new AppError(
        'Riot API request timed out.',
        503,
        'RIOT_API_TIMEOUT'
      );
    }

    throw new AppError(
      'Unable to connect to Riot API.',
      503,
      'RIOT_API_UNAVAILABLE'
    );
  }


  if (response.status === 404) {
    return {
      exists: false,

      gameName:
        normalizedGameName,

      tagLine:
        normalizedTagLine,
    };
  }


  if (
    response.status === 401 ||
    response.status === 403
  ) {
    throw new AppError(
      'Riot API authentication failed.',
      503,
      'RIOT_API_AUTH_FAILED'
    );
  }


  if (response.status === 429) {
    throw new AppError(
      'Riot API rate limit exceeded.',
      429,
      'RIOT_API_RATE_LIMITED'
    );
  }


  if (!response.ok) {
    throw new AppError(
      'Riot API is temporarily unavailable.',
      503,
      'RIOT_API_ERROR'
    );
  }


  const account =
    await response
      .json()
      .catch(() => null);


  if (
    !account ||
    !account.puuid
  ) {
    throw new AppError(
      'Invalid response from Riot API.',
      502,
      'RIOT_API_INVALID_RESPONSE'
    );
  }


  return {
    exists: true,

    puuid:
      String(account.puuid),

    gameName:
      String(
        account.gameName ||
        normalizedGameName
      ),

    tagLine:
      String(
        account.tagLine ||
        normalizedTagLine
      ),
  };
}


module.exports = {
  lookupValorantAccount,
};