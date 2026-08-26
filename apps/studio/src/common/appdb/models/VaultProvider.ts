import { loadEncryptionKey } from '@/common/encryption_key'
import { Column, Entity } from 'typeorm'
import { EncryptTransformer } from '../transformers/Transformers'
import { ApplicationEntity } from './application_entity'
import { VaultProviderType } from '@/lib/vault/types'

const encrypt = new EncryptTransformer(loadEncryptionKey())

/**
 * Connection details for one vault. Per-machine and encrypted at rest, so this
 * never travels with an exported connection — only the secret refs do.
 *
 * `name` is the stable identifier a connection's refs pin to, NOT the id. Two
 * teammates who each add a vault called "Qa Vault" share the same wiring.
 */
@Entity({ name: 'vault_provider' })
export class VaultProvider extends ApplicationEntity {

  withProps(props?: any): VaultProvider {
    if (props) VaultProvider.merge(this, props)
    return this
  }

  @Column({ type: 'varchar', nullable: false, unique: true })
  name: string

  @Column({ type: 'varchar', nullable: false, default: 'azure-key-vault' })
  providerType: VaultProviderType = 'azure-key-vault'

  @Column({ type: 'varchar', nullable: true })
  vaultUrl: Nullable<string> = null

  @Column({ type: 'varchar', nullable: true })
  tenantId: Nullable<string> = null

  @Column({ type: 'varchar', nullable: true })
  clientId: Nullable<string> = null

  /** Never leaves the utility process. `list` substitutes a boolean for it. */
  @Column({ type: 'varchar', nullable: true, transformer: [encrypt] })
  clientSecret: Nullable<string> = null

  /** Fallback order for refs that do not pin a vault. Lower runs first. */
  @Column({ type: 'integer', nullable: false, default: 0 })
  position = 0
}
