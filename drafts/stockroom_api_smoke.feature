@api @smoke @critical
Feature: StockRoom API smoke (AI stub draft)

  # Generated offline (no LLM_API_KEY). Replace via `npm run generate` with a key,
  # then run `npm run guardrails` and move into approved/ after human review.

  Scenario: Health endpoint is reachable
    When I send a GET request to "/api/health"
    Then the response status code should be 200

  Scenario: Login with valid credentials
    When I send a POST request to "/api/auth" with body:
      """
      {"username":"standard","password":"password123"}
      """
    Then the response status code should be 200
    And the response field "token" should not be empty
