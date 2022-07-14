// Extension of main nevermined object
import { Instantiable, InstantiableConfig } from "@nevermined-io/sdk-js/dist/node/Instantiable.abstract";
import { AccessProofTemplate } from "./AccessProofTemplate";
import { AccessProofCondition } from "./AccessProofCondition";

export class Dtp extends Instantiable {
    public accessProofCondition : AccessProofCondition
    public accessProofTemplate : AccessProofTemplate

    public static async getInstance(config: InstantiableConfig): Promise<Dtp> {
        const dtp = new Dtp()
        dtp.setInstanceConfig(config)
        dtp.accessProofCondition = await AccessProofCondition.getInstance(config)
        dtp.accessProofTemplate = await AccessProofTemplate.getInstanceDtp(config, dtp)
        return dtp
    }
}

