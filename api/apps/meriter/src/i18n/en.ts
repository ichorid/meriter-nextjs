export const en = {
  'setup.welcome': 'Meriter bot connected to "{community}"',
  'setup.admin.hi': 'Hi, admin of {community}! Configure your community in the web app.',
  'errors.generic': 'Something went wrong. Please try again later.',
  'updates.publication.saved': 'Your publication has been recorded.',
  'updates.poll.created': 'Poll created successfully.',
  'poll.created': 'New poll: {question}. Vote here: {dualLinks}',
  'community.welcome': 'In this community, a merit system is active. Important messages won\'t be lost.\n\nRating link: {dualLinksCommunity}\n\n{hashtags}\n\nTip: To set a beneficiary, use /ben:@username at the start. For example: "/ben:@john #value"',
};

export type TranslationKeys = keyof typeof en;

