import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@ogado/contracts'],
  agentRules: false,
};

export default config;
