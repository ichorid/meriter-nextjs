import { Test, TestingModule } from '@nestjs/testing';
import { CommunityDefaultsService } from '../src/domain/services/community-defaults.service';
import { ActionType } from '../src/domain/common/constants/action-types.constants';
import type { PermissionRule } from '../src/domain/models/community/community.schema';

describe('CommunityDefaultsService', () => {
  let service: CommunityDefaultsService;

  // Helper function to find a rule by role and action
  function findRule(
    rules: PermissionRule[],
    role: 'superadmin' | 'lead' | 'participant',
    action: ActionType,
  ): PermissionRule | undefined {
    return rules.find(r => r.role === role && r.action === action);
  }

  // Helper function to count occurrences of a rule
  function countRuleOccurrences(
    rules: PermissionRule[],
    role: 'superadmin' | 'lead' | 'participant',
    action: ActionType,
  ): number {
    return rules.filter(r => r.role === role && r.action === action).length;
  }

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CommunityDefaultsService],
    }).compile();

    service = module.get<CommunityDefaultsService>(CommunityDefaultsService);
  });

  describe('Base Rules', () => {
    it('should return base rules when typeTag is undefined', () => {
      const rules = service.getDefaultPermissionRules(undefined);
      expect(rules.length).toBeGreaterThan(0);

      // Check for participant:VOTE rule (no canVoteForOwnPosts - self-voting now uses currency constraint)
      const participantVoteRule = findRule(rules, 'participant', ActionType.VOTE);
      expect(participantVoteRule).toBeDefined();
      expect(participantVoteRule?.allowed).toBe(true);
      // NOTE: canVoteForOwnPosts is no longer set - self-voting is handled by currency constraints in VoteService
      expect(participantVoteRule?.conditions?.canVoteForOwnPosts).toBeUndefined();
    });

    it('should return base rules when typeTag is custom', () => {
      const rules = service.getDefaultPermissionRules('custom');
      expect(rules.length).toBeGreaterThan(0);

      // Check for participant:VOTE rule (no canVoteForOwnPosts - self-voting now uses currency constraint)
      const participantVoteRule = findRule(rules, 'participant', ActionType.VOTE);
      expect(participantVoteRule).toBeDefined();
      expect(participantVoteRule?.allowed).toBe(true);
      expect(participantVoteRule?.conditions?.canVoteForOwnPosts).toBeUndefined();
    });

    it('should include all expected base rules for each role and action', () => {
      const rules = service.getDefaultPermissionRules();

      // Superadmin should have all actions
      for (const action of Object.values(ActionType)) {
        const rule = findRule(rules, 'superadmin', action);
        expect(rule).toBeDefined();
        expect(rule?.allowed).toBe(true);
      }

      // Lead should have specific permissions
      expect(findRule(rules, 'lead', ActionType.POST_PUBLICATION)?.allowed).toBe(true);
      expect(findRule(rules, 'lead', ActionType.CREATE_POLL)?.allowed).toBe(true);
      expect(findRule(rules, 'lead', ActionType.EDIT_PUBLICATION)?.allowed).toBe(true);
      expect(findRule(rules, 'lead', ActionType.DELETE_PUBLICATION)?.allowed).toBe(true);
      expect(findRule(rules, 'lead', ActionType.VOTE)?.allowed).toBe(true);
      expect(findRule(rules, 'lead', ActionType.COMMENT)?.allowed).toBe(true);
      expect(findRule(rules, 'lead', ActionType.VIEW_COMMUNITY)?.allowed).toBe(true);

      // Participant should have specific permissions
      expect(findRule(rules, 'participant', ActionType.POST_PUBLICATION)?.allowed).toBe(true);
      expect(findRule(rules, 'participant', ActionType.CREATE_POLL)?.allowed).toBe(true);
      expect(findRule(rules, 'participant', ActionType.VOTE)?.allowed).toBe(true);
      expect(findRule(rules, 'participant', ActionType.COMMENT)?.allowed).toBe(true);
      expect(findRule(rules, 'participant', ActionType.VIEW_COMMUNITY)?.allowed).toBe(true);

      // Note: Viewer role has been removed - all users are now participants by default
    });

    it('should have participant:VOTE rule without canVoteForOwnPosts condition (handled by currency constraint)', () => {
      const rules = service.getDefaultPermissionRules();
      const participantVoteRule = findRule(rules, 'participant', ActionType.VOTE);

      expect(participantVoteRule).toBeDefined();
      expect(participantVoteRule?.allowed).toBe(true);
      // canVoteForOwnPosts is no longer used - self-voting is allowed with wallet-only constraint
      expect(participantVoteRule?.conditions?.canVoteForOwnPosts).toBeUndefined();
    });
  });

  describe('Future-Vision Override Tests', () => {
    it('should have participant:VOTE rule without conditions (self-voting via currency constraint)', () => {
      const rules = service.getDefaultPermissionRules('future-vision');
      const participantVoteRule = findRule(rules, 'participant', ActionType.VOTE);

      expect(participantVoteRule).toBeDefined();
      expect(participantVoteRule?.allowed).toBe(true);
      // No canVoteForOwnPosts - self-voting is wallet-only, enforced in VoteService
      expect(participantVoteRule?.conditions).toBeUndefined();
    });

    it('should have lead:VOTE rule without conditions (self-voting via currency constraint)', () => {
      const rules = service.getDefaultPermissionRules('future-vision');
      const leadVoteRule = findRule(rules, 'lead', ActionType.VOTE);

      expect(leadVoteRule).toBeDefined();
      expect(leadVoteRule?.allowed).toBe(true);
      expect(leadVoteRule?.conditions).toBeUndefined();
    });

    it('should preserve all other base rules unchanged', () => {
      const baseRules = service.getDefaultPermissionRules();
      const futureVisionRules = service.getDefaultPermissionRules('future-vision');

      // Check that non-overridden rules remain the same
      const baseParticipantPost = findRule(baseRules, 'participant', ActionType.POST_PUBLICATION);
      const fvParticipantPost = findRule(futureVisionRules, 'participant', ActionType.POST_PUBLICATION);
      expect(fvParticipantPost).toEqual(baseParticipantPost);

      const baseLeadPost = findRule(baseRules, 'lead', ActionType.POST_PUBLICATION);
      const fvLeadPost = findRule(futureVisionRules, 'lead', ActionType.POST_PUBLICATION);
      expect(fvLeadPost).toEqual(baseLeadPost);

      // Note: Viewer role has been removed - all users are now participants by default
    });

    it('should have exactly one participant:VOTE rule (no duplicates)', () => {
      const rules = service.getDefaultPermissionRules('future-vision');
      const count = countRuleOccurrences(rules, 'participant', ActionType.VOTE);
      expect(count).toBe(1);
    });

    it('should have exactly one lead:VOTE rule (no duplicates)', () => {
      const rules = service.getDefaultPermissionRules('future-vision');
      const count = countRuleOccurrences(rules, 'lead', ActionType.VOTE);
      expect(count).toBe(1);
    });
  });

  describe('Marathon-of-Good Override Tests', () => {
    it('should have participant:VOTE rule without canVoteForOwnPosts (marathon-of-good)', () => {
      const rules = service.getDefaultPermissionRules('marathon-of-good');
      const participantVoteRule = findRule(rules, 'participant', ActionType.VOTE);

      expect(participantVoteRule).toBeDefined();
      expect(participantVoteRule?.allowed).toBe(true);
      expect(participantVoteRule?.conditions).toBeUndefined();
    });

    // Note: Viewer role has been removed - all users are now participants by default
    // Tests for viewer role have been removed as the role no longer exists

    it('should preserve all other base rules unchanged', () => {
      const baseRules = service.getDefaultPermissionRules();
      const marathonRules = service.getDefaultPermissionRules('marathon-of-good');

      // Check that non-overridden rules remain the same
      const baseParticipantPost = findRule(baseRules, 'participant', ActionType.POST_PUBLICATION);
      const marathonParticipantPost = findRule(marathonRules, 'participant', ActionType.POST_PUBLICATION);
      expect(marathonParticipantPost).toEqual(baseParticipantPost);

      const baseLeadVote = findRule(baseRules, 'lead', ActionType.VOTE);
      const marathonLeadVote = findRule(marathonRules, 'lead', ActionType.VOTE);
      expect(marathonLeadVote).toEqual(baseLeadVote);
    });
  });

  describe('Support Override Tests', () => {
    it('should have participant:VOTE rule without canVoteForOwnPosts', () => {
      const rules = service.getDefaultPermissionRules('support');
      const participantVoteRule = findRule(rules, 'participant', ActionType.VOTE);

      expect(participantVoteRule).toBeDefined();
      expect(participantVoteRule?.allowed).toBe(true);
      expect(participantVoteRule?.conditions).toBeUndefined();
    });

    it('should preserve all other base rules unchanged', () => {
      const baseRules = service.getDefaultPermissionRules();
      const supportRules = service.getDefaultPermissionRules('support');

      // Check that non-overridden rules remain the same
      const baseParticipantPost = findRule(baseRules, 'participant', ActionType.POST_PUBLICATION);
      const supportParticipantPost = findRule(supportRules, 'participant', ActionType.POST_PUBLICATION);
      expect(supportParticipantPost).toEqual(baseParticipantPost);

      const baseLeadVote = findRule(baseRules, 'lead', ActionType.VOTE);
      const supportLeadVote = findRule(supportRules, 'lead', ActionType.VOTE);
      expect(supportLeadVote).toEqual(baseLeadVote);
    });
  });

  describe('Team Override Tests', () => {
    it('should override participant:POST_PUBLICATION with requiresTeamMembership: true', () => {
      const rules = service.getDefaultPermissionRules('team');
      const participantPostRule = findRule(rules, 'participant', ActionType.POST_PUBLICATION);

      expect(participantPostRule).toBeDefined();
      expect(participantPostRule?.allowed).toBe(true);
      expect(participantPostRule?.conditions?.requiresTeamMembership).toBe(true);
    });

    it('should override participant:CREATE_POLL with requiresTeamMembership: true', () => {
      const rules = service.getDefaultPermissionRules('team');
      const participantPollRule = findRule(rules, 'participant', ActionType.CREATE_POLL);

      expect(participantPollRule).toBeDefined();
      expect(participantPollRule?.allowed).toBe(true);
      expect(participantPollRule?.conditions?.requiresTeamMembership).toBe(true);
    });

    it('should have participant:VOTE rule without canVoteForOwnPosts', () => {
      const rules = service.getDefaultPermissionRules('team');
      const participantVoteRule = findRule(rules, 'participant', ActionType.VOTE);

      expect(participantVoteRule).toBeDefined();
      expect(participantVoteRule?.allowed).toBe(true);
      expect(participantVoteRule?.conditions?.canVoteForOwnPosts).toBeUndefined();
    });

    // Note: Viewer role has been removed - all users are now participants by default
    // Tests for viewer role have been removed as the role no longer exists

    it('should preserve all other base rules unchanged', () => {
      const baseRules = service.getDefaultPermissionRules();
      const teamRules = service.getDefaultPermissionRules('team');

      // Check that non-overridden rules remain the same
      const baseLeadPost = findRule(baseRules, 'lead', ActionType.POST_PUBLICATION);
      const teamLeadPost = findRule(teamRules, 'lead', ActionType.POST_PUBLICATION);
      expect(teamLeadPost).toEqual(baseLeadPost);

      const baseLeadVote = findRule(baseRules, 'lead', ActionType.VOTE);
      const teamLeadVote = findRule(teamRules, 'lead', ActionType.VOTE);
      expect(teamLeadVote).toEqual(baseLeadVote);
    });
  });

  describe('Deduplication Tests', () => {
    it('should have no duplicate rules for any role:action combination', () => {
      const typeTags = [undefined, 'custom', 'future-vision', 'marathon-of-good', 'support', 'team'];

      for (const typeTag of typeTags) {
        const rules = service.getDefaultPermissionRules(typeTag);
        const ruleKeys = new Set<string>();
        
        for (const rule of rules) {
          const key = `${rule.role}:${rule.action}`;
          expect(ruleKeys.has(key)).toBe(false); // Should not have duplicates
          ruleKeys.add(key);
        }
      }
    });

    it('should verify rule count matches expected (base rules + type-specific overrides)', () => {
      const baseRules = service.getDefaultPermissionRules();
      const baseRuleCount = baseRules.length;

      // Future-vision overrides 2 rules (participant:VOTE, lead:VOTE) - no new rules added
      // So count should be the same
      const futureVisionRules = service.getDefaultPermissionRules('future-vision');
      expect(futureVisionRules.length).toBe(baseRuleCount);

      // Marathon-of-good overrides 1 rule (participant:VOTE) without adding new ones (viewer role removed)
      // So count should be the same
      const marathonRules = service.getDefaultPermissionRules('marathon-of-good');
      expect(marathonRules.length).toBe(baseRuleCount);

      // Support overrides 1 rule (participant:VOTE) without adding new ones
      // So count should be the same
      const supportRules = service.getDefaultPermissionRules('support');
      expect(supportRules.length).toBe(baseRuleCount);

      // Team overrides 3 rules (participant:POST_PUBLICATION, participant:CREATE_POLL, 
      // participant:VOTE) without adding new ones (viewer role removed)
      // So count should be the same
      const teamRules = service.getDefaultPermissionRules('team');
      expect(teamRules.length).toBe(baseRuleCount);
    });

    it('should use Map-based deduplication (test that last-added rule wins)', () => {
      const futureVisionRules = service.getDefaultPermissionRules('future-vision');
      
      // Should have exactly one participant:VOTE rule
      const participantVoteRules = futureVisionRules.filter(
        r => r.role === 'participant' && r.action === ActionType.VOTE
      );
      expect(participantVoteRules.length).toBe(1);
      
      // That rule should NOT have canVoteForOwnPosts (no longer used)
      expect(participantVoteRules[0].conditions).toBeUndefined();
    });
  });

  describe('Integration with findMatchingRule', () => {
    it('should return future-vision participant:VOTE rule when searching rules array', () => {
      const rules = service.getDefaultPermissionRules('future-vision');
      const matchingRule = findRule(rules, 'participant', ActionType.VOTE);

      expect(matchingRule).toBeDefined();
      expect(matchingRule?.allowed).toBe(true);
      // No conditions - self-voting handled by currency constraints
      expect(matchingRule?.conditions).toBeUndefined();
    });

    it('should return correct rule for each type tag', () => {
      // Test future-vision
      const fvRules = service.getDefaultPermissionRules('future-vision');
      const fvParticipantVote = findRule(fvRules, 'participant', ActionType.VOTE);
      expect(fvParticipantVote?.allowed).toBe(true);
      expect(fvParticipantVote?.conditions).toBeUndefined();

      // Test marathon-of-good
      const marathonRules = service.getDefaultPermissionRules('marathon-of-good');
      const marathonParticipantVote = findRule(marathonRules, 'participant', ActionType.VOTE);
      expect(marathonParticipantVote?.allowed).toBe(true);
      // Note: Viewer role has been removed - all users are now participants by default

      // Test team
      const teamRules = service.getDefaultPermissionRules('team');
      const teamParticipantPost = findRule(teamRules, 'participant', ActionType.POST_PUBLICATION);
      expect(teamParticipantPost?.conditions?.requiresTeamMembership).toBe(true);
      // Note: Viewer role has been removed - all users are now participants by default

      // Test support
      const supportRules = service.getDefaultPermissionRules('support');
      const supportParticipantVote = findRule(supportRules, 'participant', ActionType.VOTE);
      expect(supportParticipantVote?.allowed).toBe(true);
    });
  });
});
