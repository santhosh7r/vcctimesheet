// Source: HR roster provided 2026-05-10. Salary figures are sensitive —
// the API endpoint and the page that consumes this are gated to admin + finance only.
//
// ctc_raw preserves the original spreadsheet text exactly.
// ctc_amount / ctc_currency / ctc_period are best-effort parsed for sorting & math.

export const EMPLOYEE_SALARIES = [
  { id: 'CON1041', first_name: 'Ganesh', last_name: 'Bhandari', title: 'Consultant', department: 'Visual Comfort Company', location: 'USA', joined_date: '2026-05-04', ctc_amount: 120000, ctc_currency: 'USD', ctc_period: 'annual', ctc_raw: 'Annual fee of $120,000' },
  { id: '100688', first_name: 'Arun Joseph', last_name: 'Arulsekar', title: 'Senior Technical Consultant', department: 'Visual Comfort Company', location: 'India', joined_date: '2026-05-04', ctc_amount: 4000000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '4000000' },
  { id: '100687', first_name: 'Jaspreet Singh', last_name: 'Rahi', title: 'QA Technical Consultant', department: 'Visual Comfort Company', location: 'India', joined_date: '2026-05-04', ctc_amount: 1500000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '1500000' },
  { id: 'CON1040', first_name: 'Sukhdeep', last_name: 'Cheema', title: 'IT Support Engineer', department: 'Visual Comfort Company', location: 'USA', joined_date: '2026-04-30', ctc_amount: 37, ctc_currency: 'USD', ctc_period: 'hourly', ctc_raw: '$37/hour' },
  { id: '100684', first_name: 'Tharun', last_name: 'A P', title: 'IT Support Engineer', department: 'Visual Comfort Company', location: 'India', joined_date: '2026-04-06', ctc_amount: 305100, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '305100' },
  { id: 'D4US-010', first_name: 'Irfan', last_name: 'Mukhtar', title: 'JDE Technical Consultant (EDI)', department: 'Visual Comfort Company', location: 'USA', joined_date: '2026-04-06', ctc_amount: 120000, ctc_currency: 'USD', ctc_period: 'annual', ctc_raw: '$ 120,000 per year' },
  { id: 'D4US-009', first_name: 'Madhavi', last_name: 'Ummalanani', title: 'QA Analyst', department: 'Visual Comfort Company', location: 'USA', joined_date: '2026-04-06', ctc_amount: 100000, ctc_currency: 'USD', ctc_period: 'annual', ctc_raw: '$100,000 per year' },
  { id: '100683', first_name: 'Bhavesh', last_name: 'Pandya', title: 'Senior Software Tester', department: 'Visual Comfort Company', location: 'India', joined_date: '2026-03-25', ctc_amount: 1000000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '1000000' },
  { id: '100682', first_name: 'Swetha', last_name: 'Kumar', title: 'Technical Consultant', department: 'Visual Comfort Company', location: 'India', joined_date: '2026-03-23', ctc_amount: 2000004, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '2000004' },
  { id: '100678', first_name: 'Ashwath Soosainathan', last_name: 'Pandian', title: 'Senior Software Tester', department: 'Visual Comfort Company', location: 'India', joined_date: '2026-03-06', ctc_amount: 1100000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '1100000' },
  { id: '100677', first_name: 'Lakshmanan', last_name: 'Krishnan', title: 'Technical Architect', department: 'Visual Comfort Company', location: 'India', joined_date: '2026-03-05', ctc_amount: 2800000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '2800000' },
  { id: 'CON1037', first_name: 'Gayathri', last_name: 'Murugadas', title: 'Consultant', department: 'Visual Comfort Company', location: 'India', joined_date: '2026-03-02', ctc_amount: 2600000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '2600000' },
  { id: '100675', first_name: 'Keerthivasan', last_name: 'Vijayagothandaraman', title: 'Senior Functional Consultant', department: 'Visual Comfort Company', location: 'India', joined_date: '2026-03-02', ctc_amount: 1500000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '1500000' },
  { id: '100672', first_name: 'B.N.', last_name: 'Swaminathan', title: 'Junior Developer', department: 'Visual Comfort Company', location: 'India', joined_date: '2026-02-02', ctc_amount: 400000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '400000' },
  { id: '100673', first_name: 'Reiyo Christ', last_name: 'V', title: 'Junior Developer', department: 'Visual Comfort Company', location: 'India', joined_date: '2026-02-02', ctc_amount: 400000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '400000' },
  { id: '100674', first_name: 'S. DHAVAN KUMAR', last_name: 'REDDY', title: 'Junior Developer', department: 'Visual Comfort Company', location: 'India', joined_date: '2026-02-02', ctc_amount: 400000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '400000' },
  { id: '100671', first_name: 'Aakash', last_name: 'Priyadharshan P', title: 'Junior Developer', department: 'Visual Comfort Company', location: 'India', joined_date: '2026-02-02', ctc_amount: 400000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '400000' },
  { id: 'CON1036', first_name: 'Andrea', last_name: 'Solorzano', title: 'Consultant', department: 'Visual Comfort Company', location: 'USA', joined_date: '2026-02-18', ctc_amount: 52, ctc_currency: 'USD', ctc_period: 'hourly', ctc_raw: '$52 / Hour' },
  { id: '100667', first_name: 'Abhinandhan', last_name: 'P S', title: 'Technical Consultant', department: 'Visual Comfort Company', location: 'India', joined_date: '2026-02-12', ctc_amount: 1400004, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '1400004' },
  { id: 'CON1035', first_name: 'Saritha', last_name: 'Thotta', title: 'Consultant', department: 'Visual Comfort Company', location: 'USA', joined_date: '2026-02-11', ctc_amount: 58, ctc_currency: 'USD', ctc_period: 'hourly', ctc_raw: '$58 / Hour' },
  { id: '100661', first_name: 'Aravindh', last_name: 'Perumal', title: 'Senior Functional Consultant', department: 'Visual Comfort Company', location: 'India', joined_date: '2026-01-28', ctc_amount: 2700000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '2700000' },
  { id: 'CON1032', first_name: 'Humera', last_name: 'Ahmed', title: 'Senior Full Stack Developer', department: 'Visual Comfort Company', location: 'USA', joined_date: '2026-01-22', ctc_amount: 65, ctc_currency: 'USD', ctc_period: 'hourly', ctc_raw: 'hourly fee of USD $ 65.' },
  { id: 'CON1031', first_name: 'Janna', last_name: 'Cox', title: 'Consultant', department: 'Visual Comfort Company', location: 'USA', joined_date: '2026-01-19', ctc_amount: 57, ctc_currency: 'USD', ctc_period: 'hourly', ctc_raw: 'hourly fee of USD $ 57.' },
  { id: '100659', first_name: 'Bholeshankar', last_name: 'Pathak', title: 'Senior Technical Consultant', department: 'Visual Comfort Company', location: 'India', joined_date: '2026-01-19', ctc_amount: 3000000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '3000000' },
  { id: 'CON1029', first_name: 'Thomas', last_name: 'Bruttell', title: 'Consultant', department: 'Visual Comfort Company', location: 'USA', joined_date: '2025-12-01', ctc_amount: 75, ctc_currency: 'USD', ctc_period: 'hourly', ctc_raw: 'an hourly fee of USD $ 75' },
  { id: '100658', first_name: 'Manjari', last_name: 'Porkai', title: 'Senior QA Technical Consultant', department: 'Visual Comfort Company', location: 'India', joined_date: '2026-01-12', ctc_amount: 1600008, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '1600008' },
  { id: 'D4US-008', first_name: 'Javal', last_name: 'Vadera', title: 'Junior Financial Analyst', department: 'Visual Comfort Company', location: 'USA', joined_date: '2026-01-07', ctc_amount: 80000, ctc_currency: 'USD', ctc_period: 'annual', ctc_raw: '$ 80,000 per year' },
  { id: '100657', first_name: 'Ganesh', last_name: 'Jayaraman', title: 'QA Technical Consultant', department: 'Visual Comfort Company', location: 'India', joined_date: '2026-01-07', ctc_amount: 1600008, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '1600008' },
  { id: 'D4US-007', first_name: 'Bradley', last_name: 'Lacey', title: 'D365 Functional Consultant', department: 'Visual Comfort Company', location: 'USA', joined_date: '2026-01-05', ctc_amount: 125000, ctc_currency: 'USD', ctc_period: 'annual', ctc_raw: '$ 125,000 per year.' },
  { id: '100655', first_name: 'Nitin Kumar', last_name: 'Pal', title: 'Senior Technical Consultant', department: 'Visual Comfort Company', location: 'India', joined_date: '2025-12-15', ctc_amount: 1400004, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '1400004' },
  { id: '100654', first_name: 'Arul Kumaran', last_name: 'Veerattan', title: 'Senior Solution Architect', department: 'Visual Comfort Company', location: 'India', joined_date: '2025-12-15', ctc_amount: 3200004, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '3200004' },
  { id: '100653', first_name: 'Chandan Ramkeval', last_name: 'Prajapati', title: 'Senior Technical Consultant', department: 'Visual Comfort Company', location: 'India', joined_date: '2025-12-15', ctc_amount: 2500000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '2500000' },
  { id: '100637', first_name: 'Mohammed Arif', last_name: 'kalambur patel', title: 'Senior Technical Consultant', department: 'Visual Comfort Company', location: 'India', joined_date: '2025-11-12', ctc_amount: 2800000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '2800000' },
  { id: 'CON1028', first_name: 'Nishandhini', last_name: 'Ashok Kumar', title: 'Senior Technical Program Manager - IT', department: 'Visual Comfort Company', location: 'USA', joined_date: '2025-11-06', ctc_amount: 900, ctc_currency: 'INR', ctc_period: 'hourly', ctc_raw: 'INR 900 per hour-' },
  { id: 'CON1027', first_name: 'Akhila', last_name: 'Reddy', title: 'Consultant', department: 'Visual Comfort Company', location: 'USA', joined_date: '2025-11-03', ctc_amount: null, ctc_currency: null, ctc_period: 'unknown', ctc_raw: 'Yet to receive' },
  { id: 'CON1026', first_name: 'Zamir', last_name: 'Vahora', title: 'Consultant', department: 'Visual Comfort Company', location: 'USA', joined_date: '2025-11-03', ctc_amount: null, ctc_currency: null, ctc_period: 'unknown', ctc_raw: 'Yet to receive' },
  { id: 'D4US-006', first_name: 'Bindu', last_name: 'Marella', title: 'Manager - Quality Analyst', department: 'Visual Comfort Company', location: 'USA', joined_date: '2025-10-27', ctc_amount: 130000, ctc_currency: 'USD', ctc_period: 'annual', ctc_raw: '130,000 per year' },
  { id: '100616', first_name: 'Jagadeesh', last_name: 'Raju', title: 'Senior Architect', department: 'Visual Comfort Company', location: 'India', joined_date: '2025-10-06', ctc_amount: 3000000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '3000000' },
  { id: '100617', first_name: 'Vimal', last_name: 'David', title: 'Senior Technical Consultant', department: 'Visual Comfort Company', location: 'India', joined_date: '2025-10-06', ctc_amount: 1800000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '1800000' },
  { id: '100610', first_name: 'Aruldoss', last_name: 'A', title: 'Technical Consultant', department: 'Visual Comfort Company', location: 'India', joined_date: '2025-09-18', ctc_amount: 800000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '800000' },
  { id: '100611', first_name: 'Sathishraj', last_name: 'Raju', title: 'Senior Technical Consultant', department: 'Visual Comfort Company', location: 'India', joined_date: '2025-09-22', ctc_amount: 2700000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '2700000' },
  { id: 'CON1039', first_name: 'Marcos', last_name: 'Soliz', title: 'Consultant', department: 'Visual Comfort Company', location: 'USA', joined_date: '2025-09-22', ctc_amount: 80000, ctc_currency: 'USD', ctc_period: 'annual', ctc_raw: '$ 80,000 per year.' },
  { id: '100586', first_name: 'Aldrin', last_name: 'Shaji', title: 'Senior Support Engineer', department: 'Visual Comfort Company', location: 'India', joined_date: '2025-09-01', ctc_amount: 1200000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '1200000' },
  { id: '100573', first_name: 'Divya', last_name: 'Priya', title: 'Senior Developer', department: 'Visual Comfort Company', location: 'India', joined_date: '2025-08-14', ctc_amount: 800000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '800000' },
  { id: '100689', first_name: 'Chintalakonda', last_name: 'Rajesh', title: 'Analyst- Trainee', department: 'Visual Comfort Company', location: 'India', joined_date: '2026-05-04', ctc_amount: 300000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '300000' },
  { id: '100564', first_name: 'Karthikeyan', last_name: 'Vijayan', title: 'Senior Security Consultant', department: 'Visual Comfort Company', location: 'India', joined_date: '2025-08-01', ctc_amount: 4000000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '4000000' },
  { id: '100553', first_name: 'Mohammed Abdullah', last_name: 'Khan', title: 'Senior Security Consultant', department: 'Visual Comfort Company', location: 'India', joined_date: '2025-07-15', ctc_amount: 3300000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '3300000' },
  { id: '100544', first_name: 'Nageswara Dhaveji', last_name: 'Ch', title: 'Senior Technical Consultant', department: 'Visual Comfort Company', location: 'India', joined_date: '2025-07-09', ctc_amount: 2100000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '2100000' },
  { id: '100530', first_name: 'Mohammed', last_name: 'Navazuddin', title: 'Technical Consultant', department: 'Visual Comfort Company', location: 'India', joined_date: '2025-07-01', ctc_amount: 2100000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '2100000' },
  { id: '100518', first_name: 'Sankar', last_name: 'Raman P', title: 'Senior Technical Consultant', department: 'Visual Comfort Company', location: 'India', joined_date: '2025-06-19', ctc_amount: 2200000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '2200000' },
  { id: 'CON1023', first_name: 'Gilberto', last_name: 'Gomez', title: 'Consultant', department: 'Visual Comfort Company', location: 'USA', joined_date: '2025-04-14', ctc_amount: null, ctc_currency: null, ctc_period: 'unknown', ctc_raw: 'Yet to receive' },
  { id: '100476', first_name: 'Senthil Nathan', last_name: 'Rajagopal', title: 'Senior Technical Consultant', department: 'Visual Comfort Company', location: 'India', joined_date: '2025-04-02', ctc_amount: 1400000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '1400000' },
  { id: '100474', first_name: 'Kiran', last_name: 'KalavaKollu', title: 'Senior Technical Consultant', department: 'Visual Comfort Company', location: 'India', joined_date: '2025-04-01', ctc_amount: 2700000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '2700000' },
  { id: '100464', first_name: 'Balaji', last_name: 'Padmanaban', title: 'Senior Developer', department: 'Visual Comfort Company', location: 'India', joined_date: '2025-03-10', ctc_amount: 800004, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '800004' },
  { id: '100463', first_name: 'Sasikumar', last_name: 'Saravanan', title: 'Software Developer', department: 'Visual Comfort Company', location: 'India', joined_date: '2025-03-07', ctc_amount: 750000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '750000' },
  { id: '343', first_name: 'Janani', last_name: 'Ramkumar', title: 'Project Manager', department: 'Visual Comfort Company', location: 'UAE', joined_date: '2025-02-27', ctc_amount: 9000, ctc_currency: 'AED', ctc_period: 'monthly', ctc_raw: '9000 AED' },
  { id: '100460', first_name: 'Muthu', last_name: 'Krishnan', title: 'Senior Software Tester', department: 'Visual Comfort Company', location: 'India', joined_date: '2025-02-25', ctc_amount: 900000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '900000' },
  { id: '100459', first_name: 'Vivekanandan', last_name: 'Jeevanantham', title: 'Senior Help Desk', department: 'Visual Comfort Company', location: 'India', joined_date: '2025-02-24', ctc_amount: 800000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '800000' },
  { id: '100458', first_name: 'Srinivasan', last_name: 'Pandiaraj', title: 'Senior Technical Consultant', department: 'Visual Comfort Company', location: 'India', joined_date: '2025-02-17', ctc_amount: 4800000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '4800000' },
  { id: 'D4US-001', first_name: 'Anand', last_name: 'Suchak', title: 'Senior Program Manager', department: 'Visual Comfort Company', location: 'USA', joined_date: '2024-09-09', ctc_amount: 100000, ctc_currency: 'USD', ctc_period: 'annual', ctc_raw: '$100,000 per year' },
  { id: 'CON1011', first_name: 'Rafi', last_name: 'ghafoor', title: 'Consultant', department: 'Visual Comfort Company', location: 'USA', joined_date: '2024-06-02', ctc_amount: null, ctc_currency: null, ctc_period: 'unknown', ctc_raw: 'Yet to receive' },
  { id: '100343', first_name: 'Manish', last_name: 'Dayma', title: 'Senior Technical Consultant', department: 'Visual Comfort Company', location: 'India', joined_date: '2024-01-16', ctc_amount: 5400000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '5400000' },
  { id: '100338', first_name: 'Thilak', last_name: 'G', title: 'IT - Support Lead', department: 'Visual Comfort Company', location: 'India', joined_date: '2023-11-29', ctc_amount: 1045450, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '1045450' },
  { id: '100337', first_name: 'Anant', last_name: 'Moger', title: 'Technical Consultant', department: 'Visual Comfort Company', location: 'India', joined_date: '2023-10-30', ctc_amount: 1600000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '1600000' },
  { id: '100329', first_name: 'Naveenkumar', last_name: 'Venkatesan', title: 'Senior Developer', department: 'Visual Comfort Company', location: 'India', joined_date: '2023-08-29', ctc_amount: 1347500, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '1347500' },
  { id: '100307', first_name: 'Hari Chandana', last_name: 'P', title: 'Senior Developer', department: 'Visual Comfort Company', location: 'India', joined_date: '2022-12-19', ctc_amount: 2100000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '2100000' },
  { id: '100489', first_name: 'Mahesh', last_name: 'Marimuthu', title: 'Solution Architect', department: 'Visual Comfort Company', location: 'India', joined_date: '2025-04-28', ctc_amount: 3652532, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '3652532' },
  { id: '100226', first_name: 'Karthiga', last_name: 'Adhimoolam', title: 'Technical Consultant', department: 'Visual Comfort Company', location: 'India', joined_date: '2021-06-28', ctc_amount: 1622500, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '1622500' },
  { id: '100113', first_name: 'Meenalochini', last_name: 'B', title: 'Senior Software Engineer', department: 'Visual Comfort Company', location: 'India', joined_date: '2019-11-06', ctc_amount: 840000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '840000' },
  { id: '100107', first_name: 'Shahul Hameed', last_name: 'I', title: 'Lead Software Tester', department: 'Visual Comfort Company', location: 'India', joined_date: '2019-10-28', ctc_amount: 1250000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '1250000' },
  { id: '100048', first_name: 'Krupa', last_name: 'Sarkar', title: 'Program Manager', department: 'Visual Comfort Company', location: 'India', joined_date: '2018-10-10', ctc_amount: 4425200, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '4425200' },
  { id: '100636', first_name: 'Thangaraj', last_name: 'Aran', title: 'Senior Technical Consultant', department: 'Visual Comfort Company', location: 'India', joined_date: '2025-11-10', ctc_amount: 300000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '300000' },
  { id: '100297', first_name: 'Kishore Babu', last_name: 'Jyothi', title: 'Technical Consultant', department: 'Visual Comfort Company', location: 'India', joined_date: '2022-09-30', ctc_amount: 43680000, ctc_currency: 'INR', ctc_period: 'annual', ctc_raw: '43680000' },
];

export const fullName = (r) => `${r.first_name || ''} ${r.last_name || ''}`.trim();

const CURRENCY_LOCALE = { INR: 'en-IN', USD: 'en-US', AED: 'en-AE' };
const CURRENCY_SYMBOL = { INR: '₹', USD: '$', AED: 'AED ' };

export function formatCtc(r) {
  if (r.ctc_amount == null || !r.ctc_currency) return '—';
  const locale = CURRENCY_LOCALE[r.ctc_currency] || 'en-US';
  const sym = CURRENCY_SYMBOL[r.ctc_currency] || '';
  const formatted = r.ctc_amount.toLocaleString(locale, { maximumFractionDigits: 0 });
  const period = r.ctc_period === 'annual' ? '/ yr'
    : r.ctc_period === 'hourly' ? '/ hr'
    : r.ctc_period === 'monthly' ? '/ mo'
    : '';
  return `${sym}${formatted} ${period}`.trim();
}

// Convert any CTC into approximate annual USD for sortable/comparable column.
// Uses rough FX rates frozen at time of writing — display only, not for actual finance math.
const FX_TO_USD = { INR: 1 / 83, USD: 1, AED: 1 / 3.67 };
const HOURS_PER_YEAR = 2080;
const MONTHS_PER_YEAR = 12;

export function annualizedUsd(r) {
  if (r.ctc_amount == null || !r.ctc_currency) return null;
  const fx = FX_TO_USD[r.ctc_currency];
  if (fx == null) return null;
  const usd = r.ctc_amount * fx;
  if (r.ctc_period === 'annual') return usd;
  if (r.ctc_period === 'hourly') return usd * HOURS_PER_YEAR;
  if (r.ctc_period === 'monthly') return usd * MONTHS_PER_YEAR;
  return null;
}
