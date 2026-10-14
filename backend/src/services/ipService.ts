import {networkInterfaces} from 'os';
import {NetworkInterfaceInfo} from "node:os";

class IPService {

    private IPEntryIsValid(entry: NetworkInterfaceInfo): boolean {
        return !entry.internal && entry.family === "IPv4";
    }

    getPrivateIpAddress() {

        const interfaces = networkInterfaces();

        for (const netInterfaceEntries of Object.values(interfaces)) {

            for (const entry of netInterfaceEntries ?? []) {
                if (this.IPEntryIsValid(entry)) {
                    return entry.address;
                }
            }

        }

        return null;

    }

    async getPublicIpAddress() {
        try {
            const res = await fetch("https://api.ipify.org");
            return await res.text()
        } catch (err) {
            return `Error getting IP address: ${err}`;
        }

    }

}

export default IPService;