@api @smoke @critical @stockroom
Feature: StockRoom API smoke (approved example)

  Scenario: Health endpoint is reachable
    When I send a GET request to "/api/health"
    Then the response status code should be 200

  Scenario: Login with valid credentials returns a token
    When I send a POST request to "/api/auth" with body:
      """
      {"username":"standard","password":"password123"}
      """
    Then the response status code should be 200
    And the response field "token" should not be empty

  Scenario: Locked user cannot authenticate
    When I send a POST request to "/api/auth" with body:
      """
      {"username":"locked","password":"password123"}
      """
    Then the response status code should be 403
