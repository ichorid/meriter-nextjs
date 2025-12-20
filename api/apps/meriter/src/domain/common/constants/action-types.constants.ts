/**
 * ActionType enum
 * 
 * Defines all permission-checked actions in the system.
 * Each action represents a specific operation that can be performed
 * and requires permission checking.
 */
export enum ActionType {
  // Publication actions
  POST_PUBLICATION = 'post_publication',
  CREATE_POLL = 'create_poll',
  EDIT_PUBLICATION = 'edit_publication',
  DELETE_PUBLICATION = 'delete_publication',
  
  // Voting actions
  VOTE = 'vote',
  
  // Comment actions
  COMMENT = 'comment',
  EDIT_COMMENT = 'edit_comment',
  DELETE_COMMENT = 'delete_comment',
  
  // Poll actions
  EDIT_POLL = 'edit_poll',
  DELETE_POLL = 'delete_poll',
  
  // Visibility actions
  VIEW_COMMUNITY = 'view_community',
}

