import axios, { AxiosResponse, AxiosError } from 'axios';

// Simple retry wrapper since retry-axios has compatibility issues
async function retryRequest<T>(
  requestFn: () => Promise<T>,
  maxRetries: number = 5,
  delay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on 4xx errors (client errors)
      if (error.response && error.response.status >= 400 && error.response.status < 500) {
        throw error;
      }
      
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
        console.warn(`Retry attempt ${attempt + 1}/${maxRetries}`);
      }
    }
  }
  
  throw lastError;
}

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';
const GITHUB_REST_URL = 'https://api.github.com';

export async function graphqlRequest(token: string, query: string, variables: Record<string, unknown>): Promise<AxiosResponse<any>> {
  return retryRequest(() => {
    return axios({
      url: GITHUB_GRAPHQL_URL,
      method: 'post',
      headers: {
        Authorization: `bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: { query, variables }
    });
  });
}

export async function restRequest(token: string, endpoint: string): Promise<AxiosResponse<any>> {
  return retryRequest(() => {
    return axios({
      url: `${GITHUB_REST_URL}${endpoint}`,
      method: 'get',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });
  });
}

