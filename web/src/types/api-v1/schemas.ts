// Separate file for Zod schemas to avoid pulling them into type-only imports
// This helps reduce TypeScript memory usage during type checking
// Import schemas directly from shared-types only when needed at runtime

export {
    UserSchema,
    CommunitySchema,
    PublicationSchema,
    CommentSchema,
    PollSchema,
    CreatePublicationDtoSchema,
    UpdatePublicationDtoSchema,
    CreateCommentDtoSchema,
    CreateVoteDtoSchema,
    CreatePollDtoSchema,
    CreatePollCastDtoSchema,
    UpdateCommunityDtoSchema,
} from "@meriter/shared-types";

