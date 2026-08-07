"""Import SOW resource mapping into Supabase.

Requires SUPABASE_URL and SUPABASE_KEY in the environment:
    export SUPABASE_URL=https://<ref>.supabase.co
    export SUPABASE_KEY=<anon or service-role key>
"""
import os
import sys

from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    sys.exit("ERROR: SUPABASE_URL and SUPABASE_KEY must be set in the environment.")

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

SOW_FILES = {
    "202301001": "SOW_202301001_D4_VCC_ZenDesk.pdf",
    "202401004": "SOW_202401004_D365_Krupa_Onsite_VCC_D4.pdf",
    "202404002": "SOW_202404002_ITAdminOnsiteOffshore.pdf",
    "202406001": "SOW_202406001_VCC_D4_PMO_Janani.pdf",
    "202501001": "SOW_202501001_IntegrationOnsiteOffshore.pdf",
    "202502001": "SOW_VCC_D4_202502001_PartnerInsight.docx.pdf",
    "202502003": "VCC_D4_SOW_202502003_D365FOTeam.docx.pdf",
    "202506001": "SOW_202506001_SalesforceCRM_VCC_D4_.docx.pdf",
    "202507001": "VCC_D4_SOW_202507001_InfraSecurityTeam.docx.pdf",
    "202507005": "VCC_D4_SOW_202507005_D365FO_Addon.docx.pdf",
    "202508002": "SOW_VCC_D4_202508002_PartnerInsight_AddOn.docx.pdf",
    "202509001": "VCC_D4_SOW_202509001_eCommercePod.docx.pdf",
    "202509002": "VCC_D4_SOW_202509002_8x8.docx.pdf",
    "202511001": "SOW_202511001_ITServices_Savannah_Akhila.docx.pdf",
    "202511002": "SOW_202511002_QAManager_Bindu.docx.pdf",
    "202511003": "Fixed_Bid_SOW_D365_Payment_Connector.docx.pdf",
    "202511004": "VCC_D4_SOW_202511004_SalesforceCRMAddOn.docx.pdf",
    "202511005": "SOW_202511005_PerformanceTesting.docx.pdf",
    "202512001": "SOW_202512001_JDE_OnsiteConsultant.docx.pdf",
    "202512002": "SOW_202512002_JDE_EDI_Consultants.docx.pdf",
    "202601001": "SOW_202601001_OnsiteFinanceAnalyst.docx.pdf",
    "202601002": "SOW_202601002_OnsiteIncidentManager.docx.pdf",
    "202601004": "VCC_D4_SOW_202601004_Humera_OnsiteDotNetDevdocx.pdf",
    "202602003": "VCC_D4_SOW_202602003_QATeam.docx.pdf",
    "202604002": "VCC_D4_SOW_202604002_QA_eComm_Onsite.docx.pdf",
}

rows = [
    {"name": "Hari Chandana", "project": "Salesforce - Zendesk previous", "manager": "Miti Desai", "location": "Offshore", "rate": 30, "status": "Active", "sow_number": "202301001", "comments": ""},
    {"name": "Karthiga Adhimoolam", "project": "Salesforce - Zendesk previous", "manager": "Miti Desai", "location": "Offshore", "rate": 30, "status": "Active", "sow_number": "202301001", "comments": ""},
    {"name": "Tilak G", "project": "IT Infra - Help Desk", "manager": "James Petrokus", "location": "Offshore", "rate": 30, "status": "Exit", "sow_number": "202404002", "comments": "Not part of the team from March 2026"},
    {"name": "Senthilnathan Rajagopal", "project": "IT Infra - Help Desk", "manager": "James Petrokus", "location": "Offshore", "rate": 30, "status": "Active", "sow_number": "202404002", "comments": ""},
    {"name": "Vivekanandan J", "project": "IT Infra - Help Desk", "manager": "James Petrokus", "location": "Offshore", "rate": 30, "status": "Active", "sow_number": "202404002", "comments": ""},
    {"name": "Akhila Reddy", "project": "IT Infra - Help Desk-Savanah", "manager": "Victoria Yates", "location": "Onsite", "rate": 95, "status": "Active", "sow_number": "202511001", "comments": "New SOW to be created"},
    {"name": "Anand Suchak", "project": "eComm - Tiger Ops", "manager": "Ron Gliane", "location": "Onsite", "rate": 80, "status": "Active", "sow_number": "202509001", "comments": ""},
    {"name": "Janani Ramkumar", "project": "IT Infra PMO", "manager": "James Petrokus", "location": "Offshore", "rate": 37, "status": "Active", "sow_number": "202406001", "comments": ""},
    {"name": "Aldrin Shaji", "project": "IT Infra 8x8 Contact Center", "manager": "James Petrokus", "location": "Offshore", "rate": 37, "status": "Active", "sow_number": "202509002", "comments": ""},
    {"name": "Mohammed Abdullah Khan", "project": "IT Infrastructure and Security", "manager": "James Petrokus", "location": "Offshore", "rate": 32, "status": "Active", "sow_number": "202507001", "comments": ""},
    {"name": "Karthikeyan Vijayan", "project": "IT Infrastructure and Security", "manager": "James Petrokus", "location": "Offshore", "rate": 35, "status": "Active", "sow_number": "202507001", "comments": ""},
    {"name": "Dhiraj Gurung", "project": "IT Infra Help Desk-Savanah", "manager": "Victoria Yates", "location": "Onsite", "rate": 65, "status": "Active", "sow_number": "202504003", "comments": ""},
    {"name": "Mark Soliz", "project": "IT Infra Help Desk - Onsite", "manager": "James Petrokus", "location": "Onsite", "rate": 85, "status": "Active", "sow_number": "202404002", "comments": "Draft send not signed"},
    {"name": "Pratik Parmar", "project": "DataMart Project PMO", "manager": "Rahul Agarwal", "location": "Onsite", "rate": 85, "status": "Active", "sow_number": "202402005", "comments": ""},
    {"name": "Thomas Bruttell", "project": "JDE - Onsite", "manager": "Bryan Brewer", "location": "Onsite", "rate": 110, "status": "Active", "sow_number": "202512001", "comments": ""},
    {"name": "Rafi Ghafoor", "project": "D365 Integration-Onsite", "manager": "Andrew Pfister", "location": "Onsite", "rate": 90, "status": "Active", "sow_number": "202501001", "comments": "Rate increased to 90"},
    {"name": "Pothi Raja", "project": "D365 Integration-Offshore", "manager": "Andrew Pfister", "location": "Offshore", "rate": 32, "status": "Active", "sow_number": "202501001", "comments": ""},
    {"name": "Krupa Vyas", "project": "D365 F&O", "manager": "Matt Forsyth", "location": "Onsite", "rate": 38, "status": "Active", "sow_number": "202401004", "comments": ""},
    {"name": "B N Reddy", "project": "D365 F&O", "manager": "Matt Forsyth", "location": "Offshore", "rate": 32, "status": "Active", "sow_number": "202411001", "comments": ""},
    {"name": "Srinivasan Pandiaraj", "project": "D365 F&O", "manager": "Matt Forsyth", "location": "Offshore", "rate": 39, "status": "Active", "sow_number": "202502003", "comments": ""},
    {"name": "Shahul Hameed", "project": "QA - D365 F&O", "manager": "Kene Nwobu", "location": "Offshore", "rate": 30, "status": "Active", "sow_number": "202502003", "comments": ""},
    {"name": "Meenalochini B", "project": "QA - D365 F&O", "manager": "Kene Nwobu", "location": "Offshore", "rate": 30, "status": "Active", "sow_number": "202502003", "comments": ""},
    {"name": "Anant Moger", "project": "D365 F&O", "manager": "Matt Forsyth", "location": "Offshore", "rate": 32, "status": "Active", "sow_number": "202411001", "comments": ""},
    {"name": "Kishore Babu Jyothi", "project": "D365 F&O", "manager": "Matt Forsyth", "location": "Offshore", "rate": 39, "status": "Active", "sow_number": "202502003", "comments": ""},
    {"name": "Sankar Raman", "project": "D365 F&O", "manager": "Matt Forsyth", "location": "Offshore", "rate": 39, "status": "Active", "sow_number": "202507005", "comments": ""},
    {"name": "Manish Kumar Dayma", "project": "D365 F&O", "manager": "Matt Forsyth", "location": "Offshore", "rate": 43, "status": "Active", "sow_number": "202507005", "comments": ""},
    {"name": "Thangaraj Aran", "project": "D365 F&O - Payment Processor", "manager": "Matt Forsyth", "location": "Offshore", "rate": 0, "status": "Active", "sow_number": "202511003", "comments": "Fixed Bid"},
    {"name": "Muthu Krishnan", "project": "QA - Partner Insight", "manager": "Kene Nwobu", "location": "Offshore", "rate": 32, "status": "Active", "sow_number": "202502001", "comments": ""},
    {"name": "Mahesh Marimuthu", "project": "Partner Insight", "manager": "Ron Gliane", "location": "Offshore", "rate": 37, "status": "Active", "sow_number": "202502001", "comments": ""},
    {"name": "Gayathri M", "project": "Partner Insight", "manager": "Ron Gliane", "location": "Offshore", "rate": 33, "status": "Active", "sow_number": "202502001", "comments": ""},
    {"name": "Sasikumar Saravanan", "project": "Partner Insight", "manager": "Ron Gliane", "location": "Offshore", "rate": 33, "status": "Active", "sow_number": "202502001", "comments": ""},
    {"name": "Balaji Padmanaban", "project": "Partner Insight", "manager": "Ron Gliane", "location": "Offshore", "rate": 33, "status": "Active", "sow_number": "202502001", "comments": ""},
    {"name": "Kiran KalavaKollu", "project": "Partner Insight", "manager": "Ron Gliane", "location": "Offshore", "rate": 35, "status": "Active", "sow_number": "202502001", "comments": ""},
    {"name": "Ch.Nageswara Dhaveji", "project": "Partner Insight", "manager": "Ron Gliane", "location": "Offshore", "rate": 37, "status": "Active", "sow_number": "202508002", "comments": ""},
    {"name": "Sandhirasegaran Munisami", "project": "Salesforce", "manager": "Miti Desai", "location": "Offshore", "rate": 43, "status": "Active", "sow_number": "202506001", "comments": ""},
    {"name": "Divya Priya S", "project": "Salesforce", "manager": "Miti Desai", "location": "Offshore", "rate": 35, "status": "Active", "sow_number": "202506001", "comments": ""},
    {"name": "Mohammad Nawazudeen", "project": "Salesforce", "manager": "Miti Desai", "location": "Offshore", "rate": 35, "status": "Active", "sow_number": "202511004", "comments": ""},
    {"name": "Nishandhini Ashok Kumar", "project": "Salesforce", "manager": "Miti Desai", "location": "Offshore", "rate": 32, "status": "Active", "sow_number": "202511004", "comments": ""},
    {"name": "Swaminathan B N", "project": "Salesforce", "manager": "Miti Desai", "location": "Offshore", "rate": 35, "status": "Active", "sow_number": "202506001", "comments": ""},
    {"name": "Naveenkumar Venkatesan", "project": "Salesforce", "manager": "Miti Desai", "location": "Offshore", "rate": 30, "status": "Active", "sow_number": "202511004", "comments": ""},
    {"name": "Bindu Marella", "project": "QA - Onsite", "manager": "Kene Nwobu", "location": "Onsite", "rate": 95, "status": "Active", "sow_number": "202511002", "comments": ""},
    {"name": "K P Mohammed Arif", "project": "QA - Performance", "manager": "Kene Nwobu", "location": "Offshore", "rate": 33, "status": "Active", "sow_number": "202511005", "comments": ""},
    {"name": "Aruldoss A", "project": "QA - eComm - Web B2B", "manager": "Kene Nwobu", "location": "Offshore", "rate": 37, "status": "Active", "sow_number": "202509001", "comments": ""},
    {"name": "Jagadeesh Raju", "project": "eComm - Web B2B", "manager": "Ron Gliane", "location": "Offshore", "rate": 39, "status": "Active", "sow_number": "202509001", "comments": ""},
    {"name": "Sathishraj Raju", "project": "eComm - Web B2B", "manager": "Ron Gliane", "location": "Offshore", "rate": 39, "status": "Active", "sow_number": "202509001", "comments": ""},
    {"name": "Vimal David", "project": "eComm - Web B2B", "manager": "Ron Gliane", "location": "Offshore", "rate": 39, "status": "Active", "sow_number": "202509001", "comments": ""},
    {"name": "Zamir Vahora", "project": "BA - eComm Onsite", "manager": "Kene Nwobu", "location": "Onsite", "rate": 95, "status": "Active", "sow_number": "202510001", "comments": ""},
    {"name": "Chandan R Prajapati", "project": "JDE Consultants", "manager": "Bryan Brewer", "location": "Offshore", "rate": 37, "status": "Active", "sow_number": "202512002", "comments": ""},
    {"name": "Nitin Kumar Pal", "project": "JDE Consultants", "manager": "Bryan Brewer", "location": "Offshore", "rate": 37, "status": "Active", "sow_number": "202512002", "comments": ""},
    {"name": "Arul Kumaran Veerattan", "project": "EDI Consultants", "manager": "Bryan Brewer", "location": "Offshore", "rate": 37, "status": "Active", "sow_number": "202512002", "comments": ""},
    {"name": "Bholeshankar Pathak", "project": "EDI Consultants", "manager": "Bryan Brewer", "location": "Offshore", "rate": 37, "status": "Active", "sow_number": "202512002", "comments": ""},
    {"name": "Bradley Lacey", "project": "D365 FO - Onsite", "manager": "Matt Forsyth", "location": "Onsite", "rate": 85, "status": "Active", "sow_number": "202401004", "comments": ""},
    {"name": "Jenna Cox", "project": "IT Infra - Incident Manager", "manager": "James Petrokus", "location": "Onsite", "rate": 85, "status": "Active", "sow_number": "202601002", "comments": ""},
    {"name": "Javal Vadera", "project": "IT Infra - Finance Assistant", "manager": "James Petrokus", "location": "Onsite", "rate": 60, "status": "Active", "sow_number": "202601001", "comments": ""},
    {"name": "Humera Ahmed", "project": "Partner Insight - .NET Onsite", "manager": "Ron Gliane", "location": "Onsite", "rate": 85, "status": "Active", "sow_number": "202601004", "comments": "SOW to be reviewed and signed"},
    {"name": "Ganesh Jayaraman", "project": "QA - Integration", "manager": "Kene Nwobu", "location": "Offshore", "rate": 35, "status": "Active", "sow_number": "202602003", "comments": "SOW to be reviewed and signed"},
    {"name": "Manjari", "project": "QA - D365 F&O", "manager": "Kene Nwobu", "location": "Offshore", "rate": 33, "status": "Active", "sow_number": "202602003", "comments": "SOW to be reviewed and signed"},
    {"name": "Saritha Thota", "project": "QA - Tech Lead Onsite", "manager": "Kene Nwobu", "location": "Onsite", "rate": 85, "status": "Active", "sow_number": "202602003", "comments": "SOW to be reviewed and signed"},
    {"name": "Aravindh Perumal", "project": "D365 F&O", "manager": "Matt Forsyth", "location": "Offshore", "rate": 37, "status": "Active", "sow_number": "202502003", "comments": "Functional Consultant"},
    {"name": "Abhinandhan Poorlin", "project": "D365 F&O", "manager": "Matt Forsyth", "location": "Offshore", "rate": 35, "status": "Active", "sow_number": "202502003", "comments": "Replacement to Santhosh"},
    {"name": "Andrea Solorzano", "project": "D365 F&O - Onsite", "manager": "Matt Forsyth", "location": "Onsite", "rate": 0, "status": "Active", "sow_number": "", "comments": "SOW to be created"},
    {"name": "Keerthivasan", "project": "D365 F&O", "manager": "Matt Forsyth", "location": "Offshore", "rate": 37, "status": "Active", "sow_number": "202507005", "comments": "Replacement to Krishnakumar"},
    {"name": "Bhavesh Pandya", "project": "QA", "manager": "Kene Nwobu", "location": "Offshore", "rate": 35, "status": "Active", "sow_number": "202602003", "comments": "New"},
    {"name": "Irfan Mukhtar", "project": "EDI - Onsite", "manager": "Bryan Brewer", "location": "Onsite", "rate": 0, "status": "Active", "sow_number": "", "comments": "New Onsite EDI"},
    {"name": "Madhavi Ummalanani", "project": "QA eComm - Onsite", "manager": "Kene Nwobu", "location": "Onsite", "rate": 0, "status": "Active", "sow_number": "202602003", "comments": "New Onsite QA"},
    {"name": "Ashwath", "project": "QA eComm", "manager": "Kene Nwobu", "location": "Offshore", "rate": 0, "status": "Active", "sow_number": "202502003", "comments": ""},
]

# Add sow_file
for r in rows:
    r["sow_file"] = SOW_FILES.get(r["sow_number"], "")

result = sb.table("sow_resources").insert(rows).execute()
print(f"Imported {len(result.data)} resources")

active = [r for r in result.data if r["status"] == "Active"]
total_rate = sum(float(r["rate"]) for r in active)
print(f"Active: {len(active)} | Total hourly: ${total_rate}")
