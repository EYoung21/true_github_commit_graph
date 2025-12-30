import axios, { AxiosResponse } from 'axios';
import rax from 'retry-axios';

rax.attach();

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';
const GITHUB_REST_URL = 'https://api.github.com';

export async function graphqlRequest(token: string, query: string, variables: Record<string, unknown>): Promise<AxiosResponse<any>> {
  return axios({
    url: GITHUB_GRAPHQL_URL,
    method: 'post',
    headers: {
      Authorization: `bearer ${token}`,
      'Content-Type': 'application/json'
    },
    data: { query, variables },
    raxConfig: {
      retry: 5,
      noResponseRetries: 3,
      retryDelay: 1000,
      backoffType: 'exponential',
      httpMethodsToRetry: ['POST'],
      onRetryAttempt: (err) => {
        const cfg = rax.getConfig(err);
        console.warn(`GraphQL retry attempt #${cfg?.currentRetryAttempt}`);
      }
    }
  });
}

export async function restRequest(token: string, endpoint: string): Promise<AxiosResponse<any>> {
  return axios({
    url: `${GITHUB_REST_URL}${endpoint}`,
    method: 'get',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json'
    },
    raxConfig: {
      retry: 5,
      noResponseRetries: 3,
      retryDelay: 1000,
      backoffType: 'exponential',
      httpMethodsToRetry: ['GET'],
      onRetryAttempt: (err) => {
        const cfg = rax.getConfig(err);
        console.warn(`REST retry attempt #${cfg?.currentRetryAttempt}`);
      }
    }
  });
}

