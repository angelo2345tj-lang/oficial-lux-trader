import { Injectable } from '@nestjs/common';
import { validateWithAI, localAIValidate, type AIContext, type AIValidation } from '../lib/services/ai/AIEngine';
import { evaluateInstitutionalSetup, type InstitutionalGateInput, type InstitutionalGateResult } from '../lib/services/ai/institutionalGate';
import { InstitutionalAI } from '../lib/services/ai/InstitutionalAI';
import { validateEnv, getEnvWarnings } from '../lib/services/security/envValidation';

@Injectable()
export class AiService {
  validateWithAI = validateWithAI;
  localAIValidate = localAIValidate;
  evaluateInstitutionalSetup = evaluateInstitutionalSetup;
  InstitutionalAI = InstitutionalAI;
  validateEnv = validateEnv;
  getEnvWarnings = getEnvWarnings;
}

export type { AIContext, AIValidation, InstitutionalGateInput, InstitutionalGateResult };
