import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';

type Route = {
  provider?: unknown;
  model?: unknown;
  writes_product_code?: unknown;
  context_window?: unknown;
  max_output_tokens?: unknown;
};

type Config = {
  version?: unknown;
  routes?: Record<string, Route>;
  execution?: Record<string, unknown>;
  limits?: { microtask?: Record<string, unknown>; ticket?: Record<string, unknown> };
  budget?: Record<string, unknown>;
};

function text(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function positive(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function validateRoutes(config: Config, errors: string[]): void {
  const routes = config.routes ?? {};
  for (const name of ['planner', 'coder', 'reviewer', 'integrator']) {
    const route = routes[name];
    if (!route) errors.push(`routes.${name} is required`);
    else if (!text(route.provider) || !text(route.model))
      errors.push(`routes.${name} needs a provider and model`);
  }
  const expectedWriters: Record<string, boolean> = {
    planner: false,
    coder: true,
    reviewer: false,
    integrator: false,
  };
  for (const [name, writes] of Object.entries(expectedWriters)) {
    if (routes[name]?.writes_product_code !== writes)
      errors.push(`${name} must ${writes ? '' : 'not '}write product code`);
  }
}

function validateCoder(config: Config, errors: string[]): void {
  const coder = config.routes?.coder;
  if (text(coder?.provider) && coder?.provider === config.routes?.reviewer?.provider)
    errors.push('coder and reviewer must use different providers');
  if (!positive(coder?.context_window)) errors.push('coder context_window must be positive');
  if (!positive(coder?.max_output_tokens)) errors.push('coder max_output_tokens must be positive');
}

function validateExecution(config: Config, errors: string[]): void {
  if (config.execution?.max_concurrent_coders !== 1)
    errors.push('exactly one coder may run at a time on the local model');
  if (config.execution?.review_only_after_tests_green !== true)
    errors.push('review must wait for green tests');
}

function validateLimits(config: Config, errors: string[]): void {
  for (const key of ['max_files', 'max_new_files', 'max_changed_lines']) {
    if (!positive(config.limits?.microtask?.[key]))
      errors.push(`limits.microtask.${key} must be positive`);
  }
  if (!positive(config.limits?.ticket?.max_microtasks))
    errors.push('limits.ticket.max_microtasks must be positive');
}

function validateContextBudget(config: Config, errors: string[]): void {
  const context = config.limits?.microtask?.max_context_tokens;
  const window = config.routes?.coder?.context_window;
  if (!positive(context)) errors.push('limits.microtask.max_context_tokens must be positive');
  else if (positive(window) && Number(context) > Number(window))
    errors.push('microtask context budget exceeds the coder window');
}

function validateBudget(config: Config, errors: string[]): void {
  const soft = config.budget?.milestone_soft_limit;
  const hard = config.budget?.milestone_hard_stop;
  if (!positive(soft) || !positive(hard) || Number(soft) >= Number(hard))
    errors.push('budget needs soft_limit < hard_stop, both positive');
}

function main(): void {
  const config = parse(readFileSync('docs/orchestration.yaml', 'utf8')) as Config;
  const errors: string[] = [];
  if (config.version !== 1) errors.push('version must be 1');
  validateRoutes(config, errors);
  validateCoder(config, errors);
  validateExecution(config, errors);
  validateLimits(config, errors);
  validateContextBudget(config, errors);
  validateBudget(config, errors);
  if (errors.length > 0) {
    for (const error of errors) console.error(`orchestration: ${error}`);
    process.exitCode = 1;
    return;
  }
  const coder = config.routes?.coder;
  const reviewer = config.routes?.reviewer;
  console.log(
    `orchestration: ${coder?.provider}/${coder?.model} codes; ${reviewer?.provider}/${reviewer?.model} reviews`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
