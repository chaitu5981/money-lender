# Test Cases Guide for Money Lender App

## Overview

This document provides test cases to verify the interest calculation logic, especially for:

- Transactions on anniversary dates
- 0-day calculation cells
- Year summaries with correct new principal calculations
- Multiple years with various transaction patterns

## Test Case File

The test cases are provided in `TEST_CASES.csv` which can be opened in Excel or any spreadsheet application.

## How to Use Test Cases

### 1. Open the CSV File

- Open `TEST_CASES.csv` in Excel or Google Sheets
- Each row represents a test case

### 2. Test Case Format

Each test case includes:

- **Test Case ID**: Unique identifier (TC001, TC002, etc.)
- **Description**: Brief description of the scenario
- **Interest Rate (%)**: Annual interest rate (12% in most cases)
- **Start Date**: The loan start date (usually 2024-11-17)
- **Transactions**: Semicolon-separated list of transactions
  - Format: `Date|Type|Amount`
  - Type: `receipt` (borrowal) or `payment` (repayment)
  - Example: `2024-11-17|receipt|300000;2025-11-17|payment|50000`
- **Calculation End Date**: Date up to which interest should be calculated
- **Expected Results**: Year-wise interest and new principal values

### 3. Running a Test Case

1. **Set up the test data in the app:**
   - Set the interest rate to the specified percentage
   - Add all transactions in the order specified
   - Set the calculation end date

2. **Verify the results:**
   - Check the Year 1 summary:
     - Current Year's Interest should match "Expected Year 1 Interest"
     - New Principal should match "Expected Year 1 New Principal"
   - Check Year 2 summary (if applicable):
     - Current Year's Interest should match "Expected Year 2 Interest"
     - New Principal should match "Expected Year 2 New Principal"
   - Check Year 3 summary (if applicable):
     - Current Year's Interest should match "Expected Year 3 Interest"
     - New Principal should match "Expected Year 3 New Principal"

3. **Special Verification for 0-day Calculation Cells:**
   - For transactions on anniversary dates, verify:
     - A 0-day interest calculation cell is displayed
     - The "Current Principal" shown in that cell matches the expected value
     - The new principal in the year summary = Current Principal of last calculation cell + Current Year's Interest

## Key Test Scenarios

### Basic Scenarios

- **TC001**: Single borrowal on start date
- **TC002**: Basic borrowal with repayment in middle of year
- **TC005**: Multiple transactions in a year

### Anniversary Date Scenarios (Critical)

- **TC003**: Repayment on anniversary date (0-day cell)
- **TC004**: Borrowal on anniversary date (0-day cell)
- **TC007**: Repayment on Year 2 anniversary
- **TC008**: Borrowal on Year 2 anniversary
- **TC010**: First transaction on year start, second on anniversary

### Multi-Year Scenarios

- **TC006**: Year 2 with transactions
- **TC009**: Year with no transactions (should still calculate interest)
- **TC015**: Year 3 calculation
- **TC030**: Three years with transactions on all anniversaries

### Edge Cases

- **TC016**: Repayment brings principal to zero
- **TC017**: Large repayment on anniversary
- **TC019**: Multiple transactions on same date
- **TC026**: First transaction is a repayment
- **TC027**: Repayment exceeds principal

### Verification Cases

- **TC020**: Year 2 with repayment on anniversary - verify principal calculation
- **TC021**: Year 1 with repayment on anniversary - verify principal calculation

## Important Verification Points

### For Repayments on Anniversary:

1. Check that a 0-day interest calculation cell is displayed
2. Note the "Current Principal" shown in that cell (e.g., 75000)
3. Verify: New Principal = Current Principal + Current Year's Interest
4. Ensure interest is NOT added twice

### For Borrowals on Anniversary:

1. Check that a 0-day interest calculation cell is displayed
2. Note the "Current Principal" shown in that cell
3. Verify: New Principal = Current Principal + Current Year's Interest

### For Years with No Transactions:

1. Verify that interest is still calculated for the full year
2. Check that the new principal = previous year's new principal + interest

## Expected Calculation Formula

For any year summary:

```
New Principal = Current Principal of Last Calculation Cell + Current Year's Interest
```

Where:

- **Current Principal of Last Calculation Cell**: The principal shown in the last interest calculation cell of that year (even if it's a 0-day cell)
- **Current Year's Interest**: Sum of all interest periods in that year

## Notes

- All dates are in YYYY-MM-DD format
- Interest rate is annual percentage (12% = 0.12)
- Interest calculation uses 360-day year basis
- Transactions are processed in chronological order
- The "Current Principal" in a 0-day calculation cell is the principal AFTER the transaction on the anniversary date

## Troubleshooting

If a test case fails:

1. **Check the 0-day calculation cell:**
   - Is it displayed?
   - What is the "Current Principal" shown?

2. **Check the year summary:**
   - What is the "Current Year's Interest"?
   - What is the "New Principal"?
   - Does New Principal = Current Principal of last cell + Current Year's Interest?

3. **For repayments on anniversary:**
   - Ensure interest is not being added twice
   - The current principal should be calculated correctly (principal before interest - repayment)

4. **For borrowals on anniversary:**
   - The current principal should be the principal after the transaction

## Test Case Status Tracking

You can add columns to track:

- **Status**: Pass/Fail/Not Tested
- **Actual Year 1 Interest**: What the app calculated
- **Actual Year 1 New Principal**: What the app calculated
- **Notes**: Any observations or issues found
