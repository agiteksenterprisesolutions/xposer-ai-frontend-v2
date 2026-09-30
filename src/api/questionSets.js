// src/api/questionSets.js
//
// The set of things the voice agent works through on every call. Admin-only
// and scoped to the caller's own organization from the JWT — there is no org
// parameter, and a super admin (who has no org) is rejected with a 400.
import api from './axios';

export const questionSetsAPI = {
  /** The organization's current set. `version: 0` means never configured. */
  getQuestionSet: async () => {
    const response = await api.get('/question-sets/');
    return response.data;
  },

  /**
   * Whole-list replace: the complete array, in display order, every save.
   * Order is the order the agent asks in. Only these three fields are read,
   * so the rest of the object is not worth sending back.
   */
  updateQuestionSet: async ({ questions, intro = null, askForEvidence = true }) => {
    const response = await api.put('/question-sets/', {
      questions,
      intro,
      ask_for_evidence: askForEvidence,
    });
    return response.data;
  },

  /**
   * Discards the customisation and returns the defaults at version 0. Reports
   * already submitted keep the answers they were collected with.
   */
  resetQuestionSet: async () => {
    const response = await api.delete('/question-sets/');
    return response.data;
  },
};
