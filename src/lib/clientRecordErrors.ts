const errorCode = (error: unknown) => error instanceof Error ? error.message : '';
export const clientRecordError = (error: unknown) => {
  const code = errorCode(error);
  if (code.includes('booking_not_ready')) return 'booking_not_ready';
  if (code.includes('booking_already_linked')) return 'booking_already_linked';
  if (code.includes('booking_patient_mismatch')) return 'booking_patient_mismatch';
  if (code.includes('patient_archived')) return 'patient_archived';
  if (code.includes('not_found')) return 'not_found';
  if (code.includes('not_allowed')) return 'not_allowed';
  if (code.includes('invalid_patient')) return 'invalid_patient';
  if (code.includes('potential_patient_match')) return 'potential_patient_match';
  if (code.includes('customer_not_found')) return 'customer_not_found';
  if (code.includes('invalid_assignee')) return 'invalid_assignee';
  return 'invalid_input';
};

