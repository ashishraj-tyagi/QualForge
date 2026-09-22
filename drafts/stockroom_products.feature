@api @smoke @critical
Feature: StockRoom products list (draft — review before approve)

  Scenario: Authenticated user can list products
    When I send a POST request to "/api/auth" with body:
      """
      {"username":"standard","password":"password123"}
      """
    Then the response status code should be 200
    When I send a GET request to "/api/products"
    Then the response status code should be 200
