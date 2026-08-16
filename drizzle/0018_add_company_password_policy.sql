-- Adiciona colunas de política de complexidade de senha na tabela companies
ALTER TABLE companies ADD COLUMN passwordMinLength INT NOT NULL DEFAULT 8;
ALTER TABLE companies ADD COLUMN passwordRequireUppercase BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE companies ADD COLUMN passwordRequireNumber BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE companies ADD COLUMN passwordRequireSpecial BOOLEAN NOT NULL DEFAULT FALSE;
