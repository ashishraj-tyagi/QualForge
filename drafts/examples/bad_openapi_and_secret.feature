@api @smoke
Feature: INTENTIONALLY BAD DRAFT — for guardrails demo

  # This file is meant to FAIL `npm run guardrails`.
  # See docs/demo.md for the walkthrough.

  Scenario: Invented endpoint and leaked secret
    When I send a GET request to "/api/totally-fake-admin-backdoor"
    And I use Authorization Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb
    Then the response status code should be 200
