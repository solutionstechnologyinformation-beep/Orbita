-- Marca administradores aceitos por convite que ainda precisam concluir o cadastro de 2FA.
-- Default false preserva o acesso de usuários existentes e de administradores criados diretamente.
ALTER TABLE users ADD COLUMN tfaSetupRequired BOOLEAN NOT NULL DEFAULT FALSE;
