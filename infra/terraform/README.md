# Terraform — AWS Mumbai

Provisions the pilot in ap-south-1: VPC (public EC2, private RDS), EC2 t4g.medium, RDS Postgres 16, S3 (versioned, encrypted, 90-day voice lifecycle), IAM (server + GitHub OIDC deploy role), Secrets Manager and a ₹30,000 monthly budget alarm.

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # fill domain + billing email
terraform init
terraform plan
terraform apply
```

Notes:

- Uncomment the `backend "s3"` block and create the state bucket before the first real `apply`.
- The deploy role is broad for M0 and must be narrowed before production (documented in the policy).
- Secrets values are set in AWS after apply; the app reads them from Secrets Manager / SSM.
