interface fullName {
    firstName: string;
    lastName: string;
}

class NameService {

    getFullName(): fullName {
        return {
            firstName: "Filip",
            lastName: "Canak",
        }
    }

}

export default NameService;